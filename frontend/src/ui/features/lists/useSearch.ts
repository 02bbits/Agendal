import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../../domain/types";
import {
  searchProjects,
  type NoteHit,
  type SearchFilter,
} from "../../domain/search";

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_SETTLE_MS = 200;

const EMPTY_TASKS: Task[] = [];
const EMPTY_NOTES: NoteHit[] = [];
const EMPTY_COUNTS = { all: 0, open: 0, completed: 0 };
const EMPTY_PROJECTS: never[] = [];

export interface UseSearchOptions<P extends { name: string }> {
  searchTasks: (params: {
    q?: string;
    status?: "all" | "open" | "completed";
    cursor?: string;
    filter?: SearchFilter;
    project_id?: string;
  }) => Promise<{
    items: Task[];
    counts: { all: number; open: number; completed: number };
    next_cursor: string | null;
  }>;
  searchNotes: (q: string) => Promise<{ items: NoteHit[] }>;
  projects: readonly P[];
}

export interface UseSearchResult<P extends { name: string }> {
  input: string;
  setInput: (value: string) => void;
  filter: SearchFilter | null;
  setFilter: (filter: SearchFilter | null) => void;
  completed: boolean;
  setCompleted: (completed: boolean) => void;
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  pending: boolean;
  hasCriteria: boolean;
  tasks: Task[];
  counts: { all: number; open: number; completed: number };
  nextCursor: string | null;
  notes: NoteHit[];
  projectHits: P[];
  error: boolean;
  retry: () => void;
  runNow: () => void;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
}

export function useSearch<P extends { name: string }>({
  searchTasks,
  searchNotes,
  projects,
}: UseSearchOptions<P>): UseSearchResult<P> {
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<SearchFilter | null>(null);
  const [completed, setCompleted] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [retrySeq, setRetrySeq] = useState(0);
  const [flushSeq, setFlushSeq] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [result, setResult] = useState<{
    key: string;
    tasks: Task[];
    counts: { all: number; open: number; completed: number };
    nextCursor: string | null;
    notes: NoteHit[];
    error: boolean;
  } | null>(null);

  const trimmed = input.trim();
  const key = JSON.stringify([trimmed, filter, completed, projectId, retrySeq]);
  const hasCriteria = Boolean(
    trimmed !== "" || filter || completed || projectId,
  );
  const pending = Boolean(hasCriteria && result?.key !== key);

  const prevFlushRef = useRef(flushSeq);

  useEffect(() => {
    const flushed = flushSeq !== prevFlushRef.current;
    prevFlushRef.current = flushSeq;

    if (!hasCriteria) {
      return;
    }

    let cancelled = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const [tasksRes, notesRes] = await Promise.all([
          searchTasks({
            q: trimmed,
            status: completed ? "completed" : "all",
            ...(filter ? { filter } : {}),
            ...(projectId ? { project_id: projectId } : {}),
          }),
          trimmed ? searchNotes(trimmed) : Promise.resolve({ items: [] }),
        ]);

        settleTimer = setTimeout(() => {
          if (!cancelled) {
            setResult({
              key,
              tasks: tasksRes.items,
              counts: tasksRes.counts,
              nextCursor: tasksRes.next_cursor,
              notes: notesRes.items,
              error: false,
            });
          }
        }, SEARCH_SETTLE_MS);
      } catch {
        settleTimer = setTimeout(() => {
          if (!cancelled) {
            setResult({
              key,
              tasks: [],
              counts: { all: 0, open: 0, completed: 0 },
              nextCursor: null,
              notes: [],
              error: true,
            });
          }
        }, SEARCH_SETTLE_MS);
      }
    };

    const debounceTimer = setTimeout(run, flushed ? 0 : SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [
    key,
    hasCriteria,
    flushSeq,
    trimmed,
    completed,
    filter,
    projectId,
    searchTasks,
    searchNotes,
  ]);

  const retry = useCallback(() => {
    setRetrySeq((s) => s + 1);
  }, []);

  const runNow = useCallback(() => {
    setFlushSeq((s) => s + 1);
  }, []);

  const currentResult = result?.key === key ? result : null;
  const isConstrained = Boolean(filter || completed || projectId);

  const tasks = currentResult ? currentResult.tasks : EMPTY_TASKS;
  const counts = currentResult ? currentResult.counts : EMPTY_COUNTS;
  const nextCursor = currentResult ? currentResult.nextCursor : null;
  const notes = isConstrained
    ? EMPTY_NOTES
    : currentResult
      ? currentResult.notes
      : EMPTY_NOTES;
  const projectHits = useMemo(
    () =>
      trimmed && !isConstrained
        ? searchProjects(projects, trimmed)
        : (EMPTY_PROJECTS as P[]),
    [projects, trimmed, isConstrained],
  );
  const error = currentResult ? currentResult.error : false;

  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor || !currentResult) return;
    setLoadingMore(true);
    try {
      const res = await searchTasks({
        q: trimmed,
        status: completed ? "completed" : "all",
        cursor: nextCursor,
        ...(filter ? { filter } : {}),
        ...(projectId ? { project_id: projectId } : {}),
      });
      setResult((prev) => {
        if (!prev || prev.key !== key) return prev;
        return {
          ...prev,
          tasks: [...prev.tasks, ...res.items],
          nextCursor: res.next_cursor,
        };
      });
    } catch {
      // silent on failure
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    nextCursor,
    currentResult,
    searchTasks,
    trimmed,
    completed,
    filter,
    projectId,
    key,
  ]);

  return {
    input,
    setInput,
    filter,
    setFilter,
    completed,
    setCompleted,
    projectId,
    setProjectId,
    pending,
    hasCriteria,
    tasks,
    counts,
    nextCursor,
    notes,
    projectHits,
    error,
    retry,
    runNow,
    loadMore,
    loadingMore,
  };
}
