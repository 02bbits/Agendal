import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IM-50, SEC-51: runs public/sw.js against a fake cache and checks what it will and won't touch
const source = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://agendal.test";

// Each precached page loads one script of its own, named after it
const pageHtml = (u: string) =>
  `cached ${u}<script src="/_next/static/${u.replace(/\W/g, "") || "root"}.js"></script>`;

type MatchOptions = { ignoreSearch?: boolean };
const urlOf = (input: Request | string) =>
  typeof input === "string" ? `${ORIGIN}${input}` : input.url;
const find = (
  store: Map<string, Response>,
  input: Request | string,
  { ignoreSearch }: MatchOptions = {},
) => {
  const bare = (u: string) => (ignoreSearch ? u.split("?")[0] : u);
  const key = [...store.keys()].find((k) => bare(k) === bare(urlOf(input)));
  return key ? store.get(key)?.clone() : undefined;
};

function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      addAll: async (urls: string[]) => {
        urls.forEach((u) =>
          store.set(`${ORIGIN}${u}`, new Response(pageHtml(u))),
        );
      },
      put: async (request: Request, response: Response) => {
        store.set(request.url, response);
      },
      match: async (input: Request | string, options?: MatchOptions) =>
        find(store, input, options),
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (input: Request | string, options?: MatchOptions) => {
      for (const store of stores.values()) {
        const hit = find(store, input, options);
        if (hit) return hit;
      }
    },
  };
}

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(online = true) {
  const caches = fakeCaches();
  const listeners: Record<string, Listener> = {};
  const self = {
    location: new URL(`${ORIGIN}/sw.js?v=2`),
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  const network = vi.fn(async (request: Request) => {
    if (!online) throw new TypeError("offline");
    const response = new Response(`network ${new URL(request.url).pathname}`);
    // A real same-origin fetch is "basic"; a constructed Response is "default"
    Object.defineProperty(response, "type", { value: "basic" });
    return response;
  });
  new Function("self", "caches", "fetch", "Response", "URL", source)(
    self,
    caches,
    network,
    Response,
    URL,
  );

  const fetchEvent = async (
    path: string,
    init: RequestInit & { mode?: string } = {},
  ) => {
    const { mode, ...rest } = init;
    const request = new Request(
      path.startsWith("http") ? path : `${ORIGIN}${path}`,
      rest,
    );
    // The constructor refuses "navigate", so set it afterwards
    if (mode === "navigate")
      Object.defineProperty(request, "mode", { value: "navigate" });
    let responded: Promise<Response> | undefined;
    listeners.fetch({
      request,
      respondWith: (p: Promise<Response>) => (responded = p),
    });
    return responded && (await responded);
  };
  const waited = async (type: string) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners[type]({ waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  };
  return { caches, self, network, listeners, fetchEvent, waited };
}

describe("service worker (SEC-51)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("never answers or stores the API, sign-in cookies, writes or RSC requests", async () => {
    const worker = loadWorker();
    await worker.waited("install");

    expect(await worker.fetchEvent("/api/v1/me")).toBeUndefined();
    expect(await worker.fetchEvent("/sanctum/csrf-cookie")).toBeUndefined();
    expect(
      await worker.fetchEvent("/tasks", { method: "POST", body: "x" }),
    ).toBeUndefined();
    expect(
      await worker.fetchEvent("/tasks", { headers: { RSC: "1" } }),
    ).toBeUndefined();
    expect(await worker.fetchEvent("https://other.test/a.js")).toBeUndefined();
    expect(worker.network).not.toHaveBeenCalled();
    const urls = [...worker.caches.stores.values()].flatMap((s) => [
      ...s.keys(),
    ]);
    expect(
      urls.some((u) => u.includes("/api/") || u.includes("/sanctum/")),
    ).toBe(false);
  });

  it("precaches the shell and serves hashed assets from the cache", async () => {
    const worker = loadWorker();
    await worker.waited("install");
    expect([...worker.caches.stores.keys()]).toEqual(["agendal-shell-2"]);
    // Every screen and the files its page loads, so a first visit works offline (AP §2.2)
    const cached = [...worker.caches.stores.get("agendal-shell-2")!.keys()];
    for (const path of [
      "/notes",
      "/tasks/_",
      "/_next/static/notes.js",
      "/_next/static/tasks_.js",
    ])
      expect(cached).toContain(`${ORIGIN}${path}`);

    await worker.fetchEvent("/_next/static/app.js");
    worker.network.mockClear();
    const again = await worker.fetchEvent("/_next/static/app.js");
    expect(await again?.text()).toBe("network /_next/static/app.js");
    expect(worker.network).not.toHaveBeenCalled();
  });

  it("opens the cached page, its screen's stand-in, or the shell, when offline", async () => {
    const online = loadWorker();
    await online.waited("install");
    await online.fetchEvent("/upcoming", { mode: "navigate" });

    const offline = loadWorker(false);
    offline.caches.stores.set(
      "agendal-shell-2",
      online.caches.stores.get("agendal-shell-2")!,
    );
    const page = async (path: string) =>
      (
        await (await offline.fetchEvent(path, { mode: "navigate" }))?.text()
      )?.split("<")[0];
    expect(await page("/upcoming")).toBe("network /upcoming");
    expect(await page("/projects")).toBe("cached /projects");
    expect(await page("/notes?filter=pending")).toBe("cached /notes");
    // A detail never opened online: the same screen's page, which reads its id from the URL
    expect(await page("/tasks/abc")).toBe("cached /tasks/_");
    expect(await page("/notes/abc")).toBe("cached /notes/_");
    expect(await page("/?task=abc")).toBe("cached /");
    expect(await page("/somewhere")).toBe("cached /");
  });

  it("drops old shell caches on activate, and only those", async () => {
    const worker = loadWorker();
    await worker.caches.open("agendal-shell-1");
    await worker.caches.open("something-else");
    await worker.waited("install");
    await worker.waited("activate");

    expect([...worker.caches.stores.keys()].sort()).toEqual([
      "agendal-shell-2",
      "something-else",
    ]);
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });

  it("caches the files a first visit loaded before it took over, never the API", async () => {
    const worker = loadWorker();
    await worker.waited("install");
    let pending: Promise<unknown> = Promise.resolve();
    worker.listeners.message({
      data: {
        precache: [
          "/inbox",
          `${ORIGIN}/_next/static/chunk.js`,
          `${ORIGIN}/api/v1/me`,
          `${ORIGIN}/inbox?_rsc=1`,
          "https://other.test/_next/static/x.js",
        ],
      },
      waitUntil: (p: Promise<unknown>) => (pending = p),
    });
    await pending;

    const cached = [...worker.caches.stores.get("agendal-shell-2")!.keys()];
    expect(cached).toContain(`${ORIGIN}/inbox`);
    expect(cached).toContain(`${ORIGIN}/_next/static/chunk.js`);
    expect(cached.some((u) => u.includes("/api/") || u.includes("_rsc"))).toBe(
      false,
    );
    expect(cached.every((u) => u.startsWith(ORIGIN))).toBe(true);
  });

  it("waits for the page's say-so before taking over (UX-42)", async () => {
    const worker = loadWorker();
    await worker.waited("install");
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
    worker.listeners.message({ data: "skipWaiting" });
    expect(worker.self.skipWaiting).toHaveBeenCalled();
  });
});

// #186, TK-6: a reminder push shows as a notification, and tapping it opens the task
describe("service worker reminders (TK-6)", () => {
  const push = (worker: ReturnType<typeof loadWorker>, payload: unknown) => {
    const showNotification =
      vi.fn<(title: string, options?: NotificationOptions) => Promise<void>>();
    Object.assign(worker.self, { registration: { showNotification } });
    let pending: Promise<unknown> = Promise.resolve();
    worker.listeners.push({
      data: {
        json: () => {
          if (typeof payload === "string") throw new SyntaxError("not json");
          return payload;
        },
      },
      waitUntil: (p: Promise<unknown>) => (pending = p),
    });
    return { showNotification, done: pending };
  };

  it("shows the reminder with its title, time, one-per-task tag and the task's link", async () => {
    const { showNotification, done } = push(loadWorker(), {
      title: "SQL quiz",
      body: "Mon 09:00 · SQL Course",
      url: "/tasks/t-1",
      tag: "task-t-1",
    });
    await done;
    expect(showNotification).toHaveBeenCalledWith("SQL quiz", {
      body: "Mon 09:00 · SQL Course",
      tag: "task-t-1",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: "/tasks/t-1" },
    });
  });

  it("never keeps a link to another site, and still shows something for a broken payload", async () => {
    const off = push(loadWorker(), {
      title: "x",
      url: "https://evil.example/phish",
    });
    await off.done;
    expect(off.showNotification.mock.calls[0]![1]).toMatchObject({
      data: { url: "/" },
    });

    const protocolRelative = push(loadWorker(), { url: "//evil.example" });
    await protocolRelative.done;
    expect(protocolRelative.showNotification.mock.calls[0]![1]).toMatchObject({
      data: { url: "/" },
    });

    const broken = push(loadWorker(), "garbage");
    await broken.done;
    expect(broken.showNotification).toHaveBeenCalledWith(
      "Agendal",
      expect.objectContaining({ body: "" }),
    );
  });

  const click = async (
    worker: ReturnType<typeof loadWorker>,
    windows: Array<Record<string, unknown>>,
  ) => {
    const openWindow = vi.fn(async () => null);
    Object.assign(worker.self.clients, {
      matchAll: vi.fn(async () => windows),
      openWindow,
    });
    const close = vi.fn();
    let pending: Promise<unknown> = Promise.resolve();
    worker.listeners.notificationclick({
      notification: { close, data: { url: "/tasks/t-1" } },
      waitUntil: (p: Promise<unknown>) => (pending = p),
    });
    await pending;
    return { openWindow, close };
  };

  it("tapping it focuses an open window of the app and takes it to the task", async () => {
    const focus = vi.fn(async () => {});
    const navigate = vi.fn(async () => {});
    const { openWindow, close } = await click(loadWorker(), [
      { url: `${ORIGIN}/upcoming`, focus, navigate },
    ]);
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`${ORIGIN}/tasks/t-1`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("with no window open, or one it can't move, it opens the task", async () => {
    expect((await click(loadWorker(), [])).openWindow).toHaveBeenCalledWith(
      `${ORIGIN}/tasks/t-1`,
    );
    const stuck = await click(loadWorker(), [
      {
        url: `${ORIGIN}/`,
        focus: vi.fn(async () => {}),
        navigate: vi.fn(async () => {
          throw new TypeError("not controlled");
        }),
      },
    ]);
    expect(stuck.openWindow).toHaveBeenCalledWith(`${ORIGIN}/tasks/t-1`);
  });
});
