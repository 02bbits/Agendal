"use client";

import { useEffect, useState } from "react";
import { t, type Project, type Task } from "@/ui";
import { TASK_CREATED } from "@/ui/domain/appEvents";
import {
  getProject,
  listProjects,
  type ProjectDetailResponse,
} from "@/lib/projectApi";
import { SYNCED } from "@/lib/sync";
import { rateLimited, type ApiRequestError } from "@/lib/apiError";

/** No project as a project, so the same screen shows it. */
function noProject(progress: ProjectDetailResponse["progress"]) {
  return {
    id: "none",
    name: t("project.none"),
    colour: "gray",
    open: progress.total - progress.done,
    done: progress.done,
  } as Project & { open: number; done: number };
}

const belongsTo = (task: Task, id: string) =>
  id === "none"
    ? !task.project_id || task.project_id === "none"
    : task.project_id === id;

/**
 * One project's page data: the project with its open tasks and the first completed ones (more on
 * request), every project for moving a task, and new tasks made elsewhere or pulled by sync.
 */
export function useProjectDetail(id: string) {
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [error, setError] = useState<number | null>(null);
  // A 429: the rate-limited page, and Try again loads once more (UX-43)
  const [limited, setLimited] = useState<ApiRequestError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Bumped on every load: Next keeps this page hidden while we're on a task and loads again when
  // we come back, so a new store key shows fresh rows
  const [loadSeq, setLoadSeq] = useState(0);
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((list) => {
        if (active) setAllProjects(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getProject(id)
      .then((res) => {
        if (!active) return;
        setData({ ...res, project: res.project ?? noProject(res.progress) });
        setLoadSeq((n) => n + 1);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoading(false);
        setLimited(rateLimited(err));
        setError(err?.status ?? 500);
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const retry = () => {
    setLimited(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  // A task made elsewhere (New task, sync, IM-52) joins Open once
  useEffect(() => {
    const onTask = (e: Event) => {
      const created = (e as CustomEvent<Task>).detail;
      if (!created || !belongsTo(created, id)) return;
      setData((prev) => {
        if (!prev || prev.open.some((t) => t.id === created.id)) return prev;
        return {
          ...prev,
          open: [...prev.open, created],
          progress: {
            done: prev.progress.done,
            total: prev.progress.total + 1,
          },
        };
      });
    };
    window.addEventListener(TASK_CREATED, onTask);
    window.addEventListener(SYNCED, onTask);
    return () => {
      window.removeEventListener(TASK_CREATED, onTask);
      window.removeEventListener(SYNCED, onTask);
    };
  }, [id]);

  /** The next page of completed tasks; false when it failed. */
  const loadMoreCompleted = async (): Promise<boolean> => {
    const cursor = data?.next_cursor;
    if (!cursor || loadingMore) return true;
    setLoadingMore(true);
    try {
      const res = await getProject(id, cursor);
      setData((prev) => {
        if (!prev) return prev;
        const known = new Set(prev.completed.map((t) => t.id));
        return {
          ...prev,
          completed: [
            ...prev.completed,
            ...res.completed.filter((t) => !known.has(t.id)),
          ],
          next_cursor: res.next_cursor,
        };
      });
      return true;
    } catch {
      return false;
    } finally {
      setLoadingMore(false);
    }
  };

  const renamed = (updated: Pick<Project, "name" | "colour">) =>
    setData((prev) =>
      prev
        ? {
            ...prev,
            project: {
              ...prev.project,
              name: updated.name,
              colour: updated.colour,
            },
          }
        : prev,
    );

  return {
    data,
    error,
    limited,
    retry,
    loading,
    loadingMore,
    loadSeq,
    allProjects,
    loadMoreCompleted,
    renamed,
  };
}
