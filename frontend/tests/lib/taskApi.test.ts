import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/apiError";
import { httpTaskApi } from "@/lib/taskApi";

describe("httpTaskApi (Refs #21)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls POST /api/v1/tasks/<id>/complete with JSON body and timezone header, returning parsed task", async () => {
    const fakeTask = {
      id: "t-123",
      title: "Test Task",
      done: true,
      done_at: "2026-10-23T08:00:00Z",
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ task: fakeTask }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await httpTaskApi.complete("t-123", "2026-10-23T08:00:00Z");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks/t-123/complete");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      at: "2026-10-23T08:00:00Z",
    });

    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Timezone")).toBeTruthy();

    expect(result).toEqual({ task: fakeTask });
  });

  it("calls POST /api/v1/tasks/<id>/reopen with JSON body and timezone header", async () => {
    const fakeTask = {
      id: "t-123",
      title: "Test Task",
      done: false,
      done_at: null,
    };
    const fakeNext = {
      id: "t-124",
      title: "Test Task Next",
      done: false,
      done_at: null,
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ task: fakeTask, next: fakeNext }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await httpTaskApi.reopen("t-123", "2026-10-23T08:05:00Z");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks/t-123/reopen");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      at: "2026-10-23T08:05:00Z",
    });
    expect(result).toEqual({ task: fakeTask, next: fakeNext });
  });

  it("rejects with error.not_found on 404 response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "error.not_found", message: "Task not found" },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      httpTaskApi.complete("t-missing", "2026-10-23T08:00:00Z"),
    ).rejects.toThrow("error.not_found");
  });

  it("rejects with ApiRequestError on 422 task.limit with code, status 422, and requestId", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "task.limit", request_id: "req-limit-422" },
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    try {
      await httpTaskApi.complete("t-123", "2026-10-23T08:00:00Z");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiRequestError);
      const apiErr = err as ApiRequestError;
      expect(apiErr.code).toBe("task.limit");
      expect(apiErr.status).toBe(422);
      expect(apiErr.requestId).toBe("req-limit-422");
      expect(apiErr.message).toBe("task.limit");
    }
  });

  it("rejects with code error.generic and status 500 when response is 500 without JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", {
        status: 500,
      }),
    );

    try {
      await httpTaskApi.complete("t-123", "2026-10-23T08:00:00Z");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiRequestError);
      const apiErr = err as ApiRequestError;
      expect(apiErr.code).toBe("error.generic");
      expect(apiErr.status).toBe(500);
      expect(apiErr.requestId).toBeUndefined();
      expect(apiErr.message).toBe("error.generic");
    }
  });

  it("passes through fetch TypeError on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      httpTaskApi.complete("t-123", "2026-10-23T08:00:00Z"),
    ).rejects.toThrow(TypeError);
  });

  it("encodes the id in the URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ task: { id: "a/b" } }), { status: 200 }),
    );

    await httpTaskApi.complete("a/b", "2026-10-23T08:00:00Z");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks/a%2Fb/complete");
  });
});
