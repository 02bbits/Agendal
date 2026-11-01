import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  restoreProject,
} from "../../src/lib/projectApi";

describe("projectApi client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token; path=/";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listProjects calls GET /projects", async () => {
    const mockProjects = [
      { id: "1", name: "Work", colour: "blue", created_at: "2026-01-01" },
    ];
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mockProjects), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await listProjects();
    expect(res).toEqual(mockProjects);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects",
      expect.anything(),
    );
  });

  it("createProject calls POST /projects", async () => {
    const newProj = { id: "p1", name: "New", colour: "green" as const };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...newProj, created_at: "2026-01-01" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await createProject(newProj);
    expect(res.name).toBe("New");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(newProj),
      }),
    );
  });

  it("getProject calls GET /projects/{id}", async () => {
    const detail = {
      project: {
        id: "p1",
        name: "Work",
        colour: "blue",
        open: 1,
        done: 0,
        created_at: "2026-01-01",
      },
      progress: { done: 0, total: 1 },
      open: [],
      completed: [],
      next_cursor: null,
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(detail), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await getProject("p1");
    expect(res.project.id).toBe("p1");
  });

  it("deleteProject calls DELETE /projects/{id}?tasks=move", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ undo: { task_ids: ["t1"], mode: "move" } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const res = await deleteProject("p1", "move");
    expect(res.undo.mode).toBe("move");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/p1?tasks=move",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("restoreProject calls POST /projects/{id}/restore", async () => {
    const restored = {
      id: "p1",
      name: "Work",
      colour: "blue" as const,
      created_at: "2026-01-01",
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(restored), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await restoreProject("p1", { task_ids: ["t1"], mode: "move" });
    expect(res.id).toBe("p1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/p1/restore",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ task_ids: ["t1"], mode: "move" }),
      }),
    );
  });
});
