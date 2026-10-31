import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTask, httpTaskApi, patch, projects } from "@/lib/taskApi";

describe("httpTaskApi (Refs #21, Refs #22)", () => {
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

  it("calls PATCH /api/v1/tasks/<id> with JSON body including fields and at", async () => {
    const fakeTask = {
      id: "t-123",
      title: "Updated Title",
      priority: "high",
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(fakeTask), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await httpTaskApi.patch(
      "t-123",
      { title: "Updated Title", priority: "high" },
      "2026-10-23T08:10:00Z",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks/t-123");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      title: "Updated Title",
      priority: "high",
      at: "2026-10-23T08:10:00Z",
    });

    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Timezone")).toBeTruthy();

    expect(result).toEqual(fakeTask);
  });

  it("getTask calls GET /api/v1/tasks/<id> returning parsed task", async () => {
    const fakeTask = {
      id: "t-123",
      title: "Test Task",
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(fakeTask), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getTask("t-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks/t-123");
    expect(init?.method ?? "GET").toBe("GET");
    expect(result).toEqual(fakeTask);
  });

  it("projects calls GET /api/v1/projects returning parsed projects", async () => {
    const fakeProjects = [
      {
        id: "p-1",
        name: "HCI",
        colour: "blue",
        created_at: "2026-10-01T00:00:00Z",
      },
    ];
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(fakeProjects), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await projects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/projects");
    expect(init?.method ?? "GET").toBe("GET");
    expect(result).toEqual(fakeProjects);
  });

  it("projects throws error.not_found when server responds 404", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "error.not_found", message: "Not found" },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(projects()).rejects.toThrow("error.not_found");
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

  it("rejects with error.generic when error body has no code", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", {
        status: 500,
      }),
    );

    await expect(
      httpTaskApi.complete("t-123", "2026-10-23T08:00:00Z"),
    ).rejects.toThrow("error.generic");
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
