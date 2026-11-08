import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmNote,
  forgetNotes,
  getNote,
  recallNote,
  rememberNote,
  restoreNote,
  submitNote,
} from "@/lib/noteApi";
import type { NoteResult } from "@/ui";
import done from "../../../docs/07-architecture/contracts/fixtures/note-result-done.json";
import locked from "../../../docs/07-architecture/contracts/fixtures/error-locked.json";

const ID = "8f1c2b3a-4d5e-4f7a-8b9c-0d1e2f3a4b01";
const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("submitNote (IM-42)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("posts the text with the client id, the written time and the device zone", async () => {
    fetchMock.mockResolvedValueOnce(json(201, done));

    const result = await submitNote("sql quiz monday 9am", ID);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/notes");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      client_id: ID,
      text: "sql quiz monday 9am",
      written_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(result).toEqual(done);
  });

  it("takes a replay (200) as a result too", async () => {
    fetchMock.mockResolvedValueOnce(json(200, done));
    expect(await submitNote("x", ID)).toEqual(done);
  });

  it("422 passes on the note's own reason, or the generic one", async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, { error: { code: "note.too_many_items" } }),
    );
    expect(await submitNote("x", ID)).toEqual({ error: "note.too_many_items" });

    fetchMock.mockResolvedValueOnce(json(422, { error: { code: "nope" } }));
    expect(await submitNote("x", ID)).toEqual({ error: "error.invalid" });
  });

  it("429 says how long to wait: Retry-After, then the body, then a minute", async () => {
    const limited = { error: { code: "error.rate_limited" } };
    fetchMock.mockResolvedValueOnce(
      json(429, limited, { "Retry-After": "30" }),
    );
    expect(await submitNote("x", ID)).toEqual({
      error: "error.rate_limited",
      retryAfter: 30,
    });

    fetchMock.mockResolvedValueOnce(json(429, locked));
    expect(await submitNote("x", ID)).toMatchObject({ retryAfter: 60 });

    fetchMock.mockResolvedValueOnce(json(429, limited));
    expect(await submitNote("x", ID)).toMatchObject({ retryAfter: 60 });
  });

  it.each([
    ["503 maintenance", () => json(503, { error: { code: "error.generic" } })],
    ["500", () => json(500, {})],
    ["404, no endpoint yet", () => json(404, {})],
  ])("%s reads as couldn't send", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(response());
    expect(await submitNote("x", ID)).toEqual({ error: "note.send_failed" });
  });

  it("a network error reads as couldn't send", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await submitNote("x", ID)).toEqual({ error: "note.send_failed" });
  });

  it("GET /notes/{id} returns the result, and 404 is an ApiRequestError", async () => {
    fetchMock.mockResolvedValueOnce(json(200, done));
    expect(await getNote("n1")).toEqual(done);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/notes/n1");

    fetchMock.mockResolvedValueOnce(
      json(404, { error: { code: "error.not_found" } }),
    );
    await expect(getNote("n2")).rejects.toMatchObject({ status: 404 });
  });

  it("keeps a result made in this session until it is forgotten (SC-19)", () => {
    const made = done as unknown as NoteResult;
    rememberNote(made);
    expect(recallNote(made.note.id)).toBe(made);
    forgetNotes();
    expect(recallNote(made.note.id)).toBeUndefined();
  });

  it("restore posts to the note's restore route, and maps failures to copy", async () => {
    fetchMock.mockResolvedValueOnce(json(200, done));
    expect(await restoreNote("n1")).toEqual(done);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/notes/n1/restore");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");

    fetchMock.mockResolvedValueOnce(
      json(404, { error: { code: "error.not_found" } }),
    );
    expect(await restoreNote("n1")).toEqual({ error: "error.not_found" });

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await restoreNote("n1")).toEqual({
      error: "note.needs_connection",
    });
  });

  it("apply posts to the note, keep the answer, and map failures to copy", async () => {
    fetchMock.mockResolvedValueOnce(json(200, done));
    expect(await confirmNote("n1")).toEqual(done);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/notes/n1/apply");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");

    fetchMock.mockResolvedValueOnce(
      json(409, { error: { code: "note.wrong_status" } }),
    );
    expect(await confirmNote("n1")).toEqual({
      error: "note.wrong_status",
    });

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await confirmNote("n1")).toEqual({
      error: "note.needs_connection",
    });
  });
});
