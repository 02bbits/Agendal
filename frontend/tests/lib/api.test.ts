import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";

describe("api (IM-10)", () => {
  const fetchMock = vi.fn();
  const headersOf = (call: number) =>
    new Headers(fetchMock.mock.calls[call][1].headers);

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=; max-age=0";
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends no CSRF token on reads", async () => {
    await api("/me");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headersOf(0).get("X-XSRF-TOKEN")).toBeNull();
  });

  it("fetches the CSRF cookie once, then sends it on writes", async () => {
    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "XSRF-TOKEN=abc%3D";
      return new Response(null, { status: 204 });
    });

    await api("/tasks", { method: "POST" });
    await api("/tasks", { method: "POST" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/sanctum/csrf-cookie",
      "/api/v1/tasks",
      "/api/v1/tasks",
    ]);
    expect(headersOf(1).get("X-XSRF-TOKEN")).toBe("abc=");
    expect(headersOf(2).get("X-XSRF-TOKEN")).toBe("abc=");
  });

  describe("reads in flight (AP §10)", () => {
    const answer = () => Promise.resolve(new Response('{"ok":true}'));

    it("two identical reads at the same moment share one request, each with its own body", async () => {
      fetchMock.mockImplementation(answer);

      const [a, b] = await Promise.all([api("/projects"), api("/projects")]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await a.json()).toEqual({ ok: true });
      expect(await b.json()).toEqual({ ok: true });
    });

    it("a read after the shared one answered asks again: nothing is cached", async () => {
      fetchMock.mockImplementation(answer);

      await api("/projects");
      await api("/projects");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("never shares writes, other paths or reads with an abort signal", async () => {
      fetchMock.mockImplementation(answer);
      document.cookie = "XSRF-TOKEN=abc";
      const signal = new AbortController().signal;

      await Promise.all([
        api("/tasks", { method: "POST" }),
        api("/tasks", { method: "POST" }),
        api("/projects"),
        api("/projects/none"),
        api("/notes", { signal }),
        api("/notes", { signal }),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(6);
    });
  });

  describe("ETag (#201)", () => {
    const tagged = (body: string, etag: string) =>
      new Response(body, { headers: { ETag: etag } });

    it("asks again with If-None-Match and turns a 304 into the kept body", async () => {
      fetchMock
        .mockResolvedValueOnce(tagged('{"inbox":3}', 'W/"a"'))
        .mockResolvedValueOnce(new Response(null, { status: 304 }));

      await api("/counts");
      const again = await api("/counts");

      expect(headersOf(0).get("If-None-Match")).toBeNull();
      expect(headersOf(1).get("If-None-Match")).toBe('W/"a"');
      expect(fetchMock.mock.calls[1][1].cache).toBe("no-store");
      expect(again.status).toBe(200);
      expect(await again.json()).toEqual({ inbox: 3 });
    });

    it("forgets kept answers on sign-in and sign-out", async () => {
      document.cookie = "XSRF-TOKEN=abc";
      fetchMock.mockResolvedValueOnce(tagged("{}", 'W/"a"'));

      await api("/counts");
      await api("/auth/logout", { method: "POST" });
      await api("/counts");

      expect(headersOf(2).get("If-None-Match")).toBeNull();
    });

    it("drops the kept answer when the read fails", async () => {
      fetchMock
        .mockResolvedValueOnce(tagged("{}", 'W/"a"'))
        .mockResolvedValueOnce(new Response("{}", { status: 500 }));

      await api("/counts");
      await api("/counts");
      await api("/counts");

      expect(headersOf(2).get("If-None-Match")).toBeNull();
    });
  });
});
