import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetNotes,
  makeFollowupTask,
  recallNote,
  replanFollowup,
} from "@/lib/noteApi";
import done from "../../../docs/07-architecture/contracts/fixtures/note-result-done.json";

const fetchMock = vi.fn();
const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
beforeEach(() => {
  forgetNotes();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=test-token";
});
afterEach(() => vi.unstubAllGlobals());

describe("follow-up API (IM-46)", () => {
  it("keeps a task with POST and remembers the returned result", async () => {
    fetchMock.mockResolvedValueOnce(json(200, done));
    expect(await makeFollowupTask("a/b")).toEqual(done);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/notes/a%2Fb/make-task");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(recallNote(done.note.id)).toEqual(done);
  });
  it("updates the same note with PUT and its current device zone", async () => {
    fetchMock.mockResolvedValueOnce(json(200, done));
    await replanFollowup("n1", "read tomorrow");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/notes/n1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      text: "read tomorrow",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      confirm_conflicts: false,
    });
  });
  it("answers conflicts instead of an error, and sends the confirmation on request (RV-E16)", async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, {
        error: {
          code: "note.undo_conflicts",
          tasks: [{ id: "t1", title: "SQL" }],
        },
      }),
    );
    expect(await replanFollowup("n1", "read")).toEqual({ conflicts: 1 });
    expect(recallNote(done.note.id)).toBeUndefined();
    fetchMock.mockResolvedValueOnce(json(200, done));
    expect(await replanFollowup("n1", "read", true)).toEqual(done);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      confirm_conflicts: true,
    });
  });
  it("keeps validation and rate-limit errors actionable in the editor", async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, { error: { code: "note.too_long" } }),
    );
    expect(await replanFollowup("n1", "long")).toEqual({
      error: "note.too_long",
    });
    fetchMock.mockResolvedValueOnce(
      json(
        429,
        { error: { code: "error.rate_limited" } },
        { "Retry-After": "12" },
      ),
    );
    expect(await replanFollowup("n1", "read")).toEqual({
      error: "error.rate_limited",
      retryAfter: 12,
    });
  });
  it("keeps failed requests out of the result cache", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(await makeFollowupTask("n1")).toEqual({
      error: "note.needs_connection",
    });
    expect(recallNote("n1")).toBeUndefined();
  });
});
