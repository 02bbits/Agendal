import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFLICT, forgetConflicts } from "../../src/lib/conflicts";
import {
  putTasks,
  readQueue,
  readSetting,
  readTask,
  readTasks,
  saveSetting,
} from "../../src/lib/localStore";
import { createTask, patch } from "../../src/lib/taskApi";
import { retryDelay, startSync, SYNCED, syncNow } from "../../src/lib/sync";
import { task } from "../ui/fixtures";

// IM-52: offline edits queue and sync (ADR-004, ADR-005, AP §2.2)

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const milk = task({ id: "t-1", title: "Buy milk" });
const emptyPull = {
  changes: { tasks: [], projects: [], notes: [] },
  next_cursor: 7,
  has_more: false,
};

type Handler = (
  url: string,
  init?: RequestInit,
) => Response | Promise<Response>;
let networkUp: boolean;
let server: Handler;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (!networkUp) throw new TypeError("Failed to fetch");
  return server(url, init);
});
const sent = (prefix: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith(prefix));
const body = (call: unknown[]) =>
  JSON.parse(String((call[1] as RequestInit).body));

/** The server: patches all apply, the pull has nothing new, unless a test says otherwise. */
const defaultServer: Handler = (url, init) => {
  if (url === "/api/v1/sync/patches")
    return json(200, {
      results: (JSON.parse(String(init?.body)) as unknown[]).map(
        (_, index) => ({
          index,
          status: "applied",
        }),
      ),
    });
  if (url.startsWith("/api/v1/sync?")) return json(200, emptyPull);
  if (url === "/api/v1/tasks") return json(201, JSON.parse(String(init?.body)));
  return json(404, { error: { code: "error.not_found" } });
};

beforeEach(async () => {
  networkUp = true;
  server = defaultServer;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=token";
  await putTasks([milk]);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  forgetConflicts();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase("agendal");
    request.onsuccess = request.onerror = resolve;
  });
});

describe("offline edits (AP-2)", () => {
  it("OFF-12: a write that gets no answer is queued and kept on the device, even when onLine says connected", async () => {
    networkUp = false;
    expect(navigator.onLine).toBe(true);

    const edited = await patch(
      "t-1",
      { title: "Oat milk" },
      "2026-10-23T08:00:00Z",
    );

    expect(edited.title).toBe("Oat milk");
    expect((await readTask("t-1"))?.title).toBe("Oat milk");
    expect((await readQueue()).map((q) => q.entry)).toEqual([
      {
        kind: "patch",
        entity: "task",
        id: "t-1",
        field: "title",
        value: "Oat milk",
        at: "2026-10-23T08:00:00Z",
      },
    ]);
  });

  it("a server refusal still fails the call and queues nothing", async () => {
    server = () => json(422, { error: { code: "error.invalid", fields: {} } });
    await expect(
      patch("t-1", { title: "x" }, "2026-10-23T08:00:00Z"),
    ).rejects.toThrow();
    expect(await readQueue()).toEqual([]);
  });

  it("while edits wait, a new one queues behind them instead of going first", async () => {
    networkUp = false;
    await patch("t-1", { title: "First" }, "2026-10-23T08:00:00Z");
    networkUp = true;
    fetchMock.mockClear();
    await patch("t-1", { title: "Second" }, "2026-10-23T08:01:00Z");

    expect(sent("/api/v1/tasks/")).toHaveLength(0);
    expect((await readQueue()).map((q) => q.entry)).toMatchObject([
      { value: "First" },
      { value: "Second" },
    ]);
  });
});

describe("sync (ADR-005)", () => {
  it("OFF-10, OFF-13: 100 queued edits go in order in one batch, then leave the queue; creates go first", async () => {
    networkUp = false;
    await createTask({ id: "t-new", title: "New offline" });
    for (let i = 0; i < 100; i++)
      await patch(
        "t-1",
        { title: `Edit ${i}` },
        `2026-10-23T08:00:${String(i % 60).padStart(2, "0")}Z`,
      );
    networkUp = true;

    expect(await syncNow()).toBe(true);

    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls.indexOf("/api/v1/tasks")).toBeLessThan(
      calls.indexOf("/api/v1/sync/patches"),
    );
    const [batch] = sent("/api/v1/sync/patches");
    expect(body(batch!).map((row: { value: string }) => row.value)).toEqual(
      Array.from({ length: 100 }, (_, i) => `Edit ${i}`),
    );
    expect(await readQueue()).toEqual([]);
    expect(await readSetting("cursor")).toBe(7);
  });

  it("a failed push keeps the queue and asks for a retry", async () => {
    networkUp = false;
    await patch("t-1", { title: "Oat milk" }, "2026-10-23T08:00:00Z");

    expect(await syncNow()).toBe(false);
    expect(await readQueue()).toHaveLength(1);
  });

  it("OFF-14: a stale edit takes the server's value, marks the row and asks for the conflict toast", async () => {
    networkUp = false;
    await patch("t-1", { title: "Oat milk" }, "2026-10-23T08:00:00Z");
    networkUp = true;
    server = (url, init) =>
      url === "/api/v1/sync/patches"
        ? json(200, {
            results: [{ index: 0, status: "stale", current: "Soy milk" }],
          })
        : defaultServer(url, init);
    const toast = vi.fn();
    window.addEventListener(CONFLICT, toast);

    await syncNow();

    window.removeEventListener(CONFLICT, toast);
    expect((await readTask("t-1"))?.title).toBe("Soy milk");
    expect(await readSetting("conflicts")).toEqual(["t-1"]);
    expect((toast.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      title: "Oat milk",
    });
  });

  it("OFF-21: a delete elsewhere wins over an edit here: the row leaves the device", async () => {
    networkUp = false;
    await patch("t-1", { title: "Oat milk" }, "2026-10-23T08:00:00Z");
    networkUp = true;
    server = (url, init) =>
      url.startsWith("/api/v1/sync?")
        ? json(200, {
            changes: {
              tasks: [{ ...milk, deleted_at: "2026-10-23T08:05:00Z" }],
              projects: [],
              notes: [],
            },
            next_cursor: 9,
            has_more: false,
          })
        : url === "/api/v1/sync/patches"
          ? json(200, {
              results: [{ index: 0, status: "stale", current: "Buy milk" }],
            })
          : defaultServer(url, init);

    await syncNow();

    expect(await readTask("t-1")).toBeUndefined();
    expect(await readSetting("conflicts")).toEqual(["t-1"]);
  });

  it("pulls pages until has_more is false and keeps the cursor", async () => {
    await saveSetting("cursor", 3);
    const pages = [
      {
        changes: {
          tasks: [task({ id: "t-2", title: "Two" })],
          projects: [],
          notes: [],
        },
        next_cursor: 4,
        has_more: true,
      },
      {
        changes: {
          tasks: [task({ id: "t-3", title: "Three" })],
          projects: [],
          notes: [],
        },
        next_cursor: 5,
        has_more: false,
      },
    ];
    server = (url, init) =>
      url.startsWith("/api/v1/sync?")
        ? json(200, pages.shift())
        : defaultServer(url, init);

    await syncNow();

    expect(sent("/api/v1/sync?").map(([url]) => String(url))).toEqual([
      "/api/v1/sync?cursor=3&limit=500",
      "/api/v1/sync?cursor=4&limit=500",
    ]);
    expect((await readTasks()).map((t) => t.id).sort()).toEqual([
      "t-1",
      "t-2",
      "t-3",
    ]);
    expect(await readSetting("cursor")).toBe(5);
  });

  it("OFF-15: 410 pushes the queue first, then drops the device copy and downloads it again", async () => {
    await saveSetting("cursor", 3);
    networkUp = false;
    await patch("t-1", { title: "Oat milk" }, "2026-10-23T08:00:00Z");
    networkUp = true;
    fetchMock.mockClear();
    server = (url, init) => {
      if (url.startsWith("/api/v1/sync?cursor=3"))
        return json(410, { error: { code: "sync.resync" } });
      if (url.startsWith("/api/v1/sync?"))
        return json(200, {
          changes: {
            tasks: [task({ id: "t-9", title: "From the server" })],
            projects: [],
            notes: [],
          },
          next_cursor: 40,
          has_more: false,
        });
      return defaultServer(url, init);
    };

    expect(await syncNow()).toBe(true);

    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toEqual([
      "/api/v1/sync/patches",
      "/api/v1/sync?cursor=3&limit=500",
      "/api/v1/sync?cursor=0&limit=500&full=1",
    ]);
    expect((await readTasks()).map((t) => t.id)).toEqual(["t-9"]);
    expect(await readQueue()).toEqual([]);
    expect(await readSetting("cursor")).toBe(40);
  });

  it("the first sync downloads everything (full)", async () => {
    await syncNow();
    expect(String(sent("/api/v1/sync?")[0]![0])).toBe(
      "/api/v1/sync?cursor=0&limit=500&full=1",
    );
  });
});

describe("two tabs (AP-E3, OFF-11)", () => {
  it("only the tab holding the lock syncs", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
      locks: {
        request: (
          _name: string,
          _options: unknown,
          callback: (lock: null) => unknown,
        ) => Promise.resolve(callback(null)),
      },
    });

    expect(await syncNow()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the other tab hears about a sync on the BroadcastChannel", async () => {
    const stop = startSync();
    const synced = new Promise((resolve) =>
      window.addEventListener(SYNCED, resolve, { once: true }),
    );
    // Wait for this tab's own first sync, then another tab announces one
    await syncNow();
    new BroadcastChannel("agendal-sync").postMessage("synced");

    await expect(synced).resolves.toBeTruthy();
    stop();
  });
});

it("retries after 1 s, 5 s, 30 s, then every 60 s, ±20 % (AP §2.2)", () => {
  expect([1, 2, 3, 4, 9].map((n) => retryDelay(n, 0.5))).toEqual([
    1_000, 5_000, 30_000, 60_000, 60_000,
  ]);
  expect(retryDelay(1, 0)).toBeCloseTo(800);
  expect(retryDelay(1, 1)).toBeCloseTo(1_200);
});

it("every call carries this device's id, the same each time (ADR-004 tie-break)", async () => {
  await syncNow();
  await syncNow();
  const ids = fetchMock.mock.calls.map(([, init]) =>
    new Headers((init as RequestInit).headers).get("X-Device-Id"),
  );
  expect(ids.length).toBeGreaterThan(1);
  expect(new Set(ids).size).toBe(1);
  expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
});
