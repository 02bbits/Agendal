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
    await api("/user");

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
});
