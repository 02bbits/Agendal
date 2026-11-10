import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IM-50, SEC-51: runs public/sw.js against a fake cache and checks what it will and won't touch
const source = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://agendal.test";

function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      addAll: async (urls: string[]) => {
        urls.forEach((u) =>
          store.set(`${ORIGIN}${u}`, new Response(`cached ${u}`)),
        );
      },
      put: async (request: Request, response: Response) => {
        store.set(request.url, response);
      },
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (input: Request | string) => {
      const url = typeof input === "string" ? `${ORIGIN}${input}` : input.url;
      for (const store of stores.values())
        if (store.has(url)) return store.get(url)?.clone();
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

    await worker.fetchEvent("/_next/static/app.js");
    worker.network.mockClear();
    const again = await worker.fetchEvent("/_next/static/app.js");
    expect(await again?.text()).toBe("network /_next/static/app.js");
    expect(worker.network).not.toHaveBeenCalled();
  });

  it("opens the cached page, or the shell, when offline", async () => {
    const online = loadWorker();
    await online.waited("install");
    await online.fetchEvent("/upcoming", { mode: "navigate" });

    const offline = loadWorker(false);
    offline.caches.stores.set(
      "agendal-shell-2",
      online.caches.stores.get("agendal-shell-2")!,
    );
    const seen = await offline.fetchEvent("/upcoming", { mode: "navigate" });
    expect(await seen?.text()).toBe("network /upcoming");
    const unseen = await offline.fetchEvent("/projects", { mode: "navigate" });
    expect(await unseen?.text()).toBe("cached /");
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

    expect([...worker.caches.stores.get("agendal-shell-2")!.keys()]).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/theme.js`,
      `${ORIGIN}/inbox`,
      `${ORIGIN}/_next/static/chunk.js`,
    ]);
  });

  it("waits for the page's say-so before taking over (UX-42)", async () => {
    const worker = loadWorker();
    await worker.waited("install");
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
    worker.listeners.message({ data: "skipWaiting" });
    expect(worker.self.skipWaiting).toHaveBeenCalled();
  });
});
