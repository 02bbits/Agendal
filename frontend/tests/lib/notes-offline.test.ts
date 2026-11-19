import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTimeZone } from "../../src/lib/clock";
import { loadDraft } from "../../src/lib/draft";
import { enqueue, readQueue } from "../../src/lib/localStore";
import {
  backOnlineText,
  deviceNotes,
  pendingNotes,
  reviveNote,
  submitNote,
} from "../../src/lib/noteApi";
import { NOTES_REPLAYED, syncNow, type Replayed } from "../../src/lib/sync";
import { task } from "../ui/fixtures";

// IM-53: notes written offline wait on the device and are sent in order (NC-6, ADR-003)

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const result = (id: string, status: string, created: number) => ({
  note: { id, client_id: id, status, name: null, text: id },
  changes: Array.from({ length: created }, (_, i) => ({
    kind: "created",
    label: "",
    task: task({ id: `${id}-${i}`, title: "Task" }),
  })),
  skipped: [],
});

const emptyPull = {
  changes: { tasks: [], projects: [], notes: [] },
  next_cursor: 1,
  has_more: false,
};

let networkUp: boolean;
let onLine: boolean;
let notesReply: (clientId: string) => Response;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (!networkUp) throw new TypeError("Failed to fetch");
  if (url === "/api/v1/notes")
    return notesReply(JSON.parse(String(init?.body)).client_id);
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
  return json(404, { error: { code: "error.not_found" } });
});
const posted = () =>
  fetchMock.mock.calls
    .filter(([url]) => url === "/api/v1/notes")
    .map(([, init]) => JSON.parse(String(init?.body)).client_id);
const notesInQueue = async () =>
  (await readQueue()).flatMap(({ entry }) =>
    entry.kind === "note" ? [entry.body.client_id] : [],
  );

beforeEach(() => {
  networkUp = true;
  onLine = true;
  notesReply = (id) => json(200, result(id, "done", 1));
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => onLine,
  });
  document.cookie = "XSRF-TOKEN=token";
  setTimeZone("Asia/Ho_Chi_Minh");
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase("agendal");
    request.onsuccess = request.onerror = resolve;
  });
});

describe("saving a note without a connection", () => {
  it("OFF-03: offline, the note is kept with its writing-time fields and nothing is sent", async () => {
    onLine = false;
    expect(await submitNote("buy milk", "c-1")).toEqual({
      queued: "note.saved_offline",
    });
    const [{ entry }] = await readQueue();
    expect(entry).toMatchObject({
      kind: "note",
      body: {
        client_id: "c-1",
        text: "buy milk",
        timezone: "Asia/Ho_Chi_Minh",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pendingNotes()).toMatchObject([
      { id: "c-1", status: "pending", excerpt: "buy milk" },
    ]);
  });

  it("T-NC-40: the pending note leads the device's Notes list and counts as needing a look", async () => {
    onLine = false;
    await submitNote("first", "c-1");
    await submitNote("second", "c-2");
    const page = await deviceNotes("all");
    expect(page?.items.map((n) => n.id)).toEqual(["c-2", "c-1"]);
    expect(page?.needs_count).toBe(2);
    expect((await deviceNotes("made"))?.items).toEqual([]);
  });

  it("OFF-02: no reply to the send keeps the note under the same client id; the replay makes it once", async () => {
    networkUp = false;
    expect(await submitNote("buy milk", "c-1")).toEqual({
      queued: "note.processing_failed",
    });
    expect(await notesInQueue()).toEqual(["c-1"]);

    networkUp = true;
    fetchMock.mockClear();
    expect(await syncNow()).toBe(true);
    expect(posted()).toEqual(["c-1"]);
    expect(await notesInQueue()).toEqual([]);
  });

  it("a 5xx is kept too; a 422 is the server's answer and is not", async () => {
    notesReply = () => json(503, { error: { code: "error.generic" } });
    expect(await submitNote("a", "c-1")).toEqual({
      queued: "note.processing_failed",
    });
    notesReply = () => json(422, { error: { code: "note.too_long" } });
    expect(await submitNote("b", "c-2")).toEqual({ error: "note.too_long" });
    expect(await notesInQueue()).toEqual(["c-1"]);
  });
});

describe("the replay on reconnect (OFF-04)", () => {
  async function replay() {
    const heard: Replayed[] = [];
    const listen = (event: Event) =>
      heard.push((event as CustomEvent<Replayed>).detail);
    window.addEventListener(NOTES_REPLAYED, listen);
    await syncNow();
    window.removeEventListener(NOTES_REPLAYED, listen);
    return heard;
  }
  const queueNotes = (...ids: string[]) =>
    enqueue(
      ids.map((id) => ({
        kind: "note" as const,
        body: {
          client_id: id,
          text: id,
          written_at: "2026-10-23T08:00:00.000Z",
          timezone: "Asia/Ho_Chi_Minh",
        },
      })),
    );

  it("edits go first, then notes oldest first, and the totals (planned tasks, notes to check) are announced once", async () => {
    await queueNotes("c-1");
    await enqueue([
      {
        kind: "patch",
        entity: "task",
        id: "t-1",
        field: "title",
        value: "x",
        at: "2026-10-23T08:00:00.000Z",
      },
    ]);
    await queueNotes("c-2", "c-3");
    notesReply = (id) =>
      json(
        200,
        id === "c-3"
          ? result(id, "confirm", 2)
          : result(id, "done", id === "c-1" ? 2 : 1),
      );

    const heard = await replay();

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.indexOf("/api/v1/sync/patches")).toBeLessThan(
      urls.indexOf("/api/v1/notes"),
    );
    expect(posted()).toEqual(["c-1", "c-2", "c-3"]);
    expect(heard).toEqual([{ notes: 3, tasks: 5, needs: 1 }]);
    expect(await readQueue()).toEqual([]);
  });

  it("a server error stops the replay: the rest stay queued, in order", async () => {
    await queueNotes("c-1", "c-2", "c-3");
    notesReply = (id) =>
      id === "c-2"
        ? json(503, { error: { code: "error.generic" } })
        : json(200, result(id, "done", 1));

    const heard = await replay();

    expect(posted()).toEqual(["c-1", "c-2"]);
    expect(await notesInQueue()).toEqual(["c-2", "c-3"]);
    expect(heard).toEqual([{ notes: 1, tasks: 1, needs: 0 }]);
  });

  it("a note the server refuses leaves the queue as a card with its text, without blocking the next (NU §3)", async () => {
    await queueNotes("c-1", "c-2");
    notesReply = (id) =>
      id === "c-1"
        ? json(422, { error: { code: "note.too_long" } })
        : json(200, result(id, "done", 1));

    const heard = await replay();

    expect(await notesInQueue()).toEqual([]);
    expect(heard).toEqual([{ notes: 1, tasks: 1, needs: 0 }]);
    expect(await pendingNotes()).toMatchObject([
      { id: "c-1", status: "pending", failed: true, excerpt: "c-1" },
    ]);
    // Not sent again by the next sync
    fetchMock.mockClear();
    await syncNow();
    expect(posted()).toEqual([]);
  });

  it("tapping a refused note puts its text back as the draft, ahead of an unsent one, and removes the card", async () => {
    await queueNotes("c-1");
    notesReply = () => json(422, { error: { code: "note.too_long" } });
    await replay();
    const { saveDraft } = await import("../../src/lib/draft");
    await saveDraft("unsent words");

    await reviveNote("c-1");

    expect(await loadDraft()).toBe("c-1\nunsent words");
    expect(await pendingNotes()).toEqual([]);
  });
});

describe("the back-online toast (T-NC-41)", () => {
  it.each([
    [
      { notes: 1, tasks: 1, needs: 0 },
      "Back online. 1 note turned into 1 task.",
    ],
    [
      { notes: 1, tasks: 3, needs: 0 },
      "Back online. 1 note turned into 3 tasks.",
    ],
    [
      { notes: 2, tasks: 1, needs: 0 },
      "Back online. 2 notes turned into 1 task.",
    ],
    [
      { notes: 2, tasks: 5, needs: 0 },
      "Back online. 2 notes turned into 5 tasks.",
    ],
    [
      { notes: 2, tasks: 4, needs: 1 },
      "Back online. 2 notes turned into 4 tasks. 1 needs a look.",
    ],
    [
      { notes: 3, tasks: 0, needs: 2 },
      "Back online. 3 notes turned into 0 tasks. 2 need a look.",
    ],
  ])("%j", (replayed, text) => {
    expect(backOnlineText(replayed)).toBe(text);
  });
});
