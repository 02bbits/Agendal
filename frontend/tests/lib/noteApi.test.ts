import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitNote } from "@/lib/noteApi";
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

  it("answers from the IM-02 fixture, without a request, when the mock is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_NOTES_MOCK", "1");
    vi.useFakeTimers();

    const pending = submitNote("call mum", ID);
    await vi.advanceTimersByTimeAsync(600);
    const result = await pending;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      note: { client_id: ID, text: "call mum", status: "done" },
      changes: done.changes,
    });
  });
});
