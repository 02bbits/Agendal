import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginChange,
  createTaskSyncState,
  settleFailure,
  settleSuccess,
  type TaskSyncState,
} from "../../domain/sync";
import type { Task } from "../../domain/types";

export type TaskSaveRequest = () => Promise<Task>;
export type TaskSaveErrorCallback = (error: unknown) => void;

export interface UseTaskSyncReturn {
  tasks: Task[];
  change: (
    id: string,
    fields: Partial<Task>,
    request: TaskSaveRequest,
    onError?: TaskSaveErrorCallback,
  ) => void;
  getTask: (id: string) => Task | undefined;
  acceptOccurrence: (task: Task, remove: boolean) => void;
  removeRow: (id: string) => void;
  insertRow: (task: Task) => void;
}

export function useTaskSync(initialTasks: Task[]): UseTaskSyncReturn {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const rowsRef = useRef<Task[]>(initialTasks);
  const syncState = useRef<TaskSyncState>(createTaskSyncState(initialTasks));
  const taskSeq = useRef<Map<string, number>>(new Map());
  const taskQueue = useRef<Map<string, Promise<unknown>>>(new Map());

  useEffect(() => {
    const onTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const created = customEvent?.detail;
      if (created) {
        if (rowsRef.current.some((t) => t.id === created.id)) return;
        rowsRef.current = [...rowsRef.current, created];
        setTasks(rowsRef.current);
      }
    };
    const onTaskDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      const deletedId = customEvent?.detail?.id;
      if (deletedId) {
        rowsRef.current = rowsRef.current.filter((t) => t.id !== deletedId);
        syncState.current.confirmed.delete(deletedId);
        syncState.current.writers.delete(deletedId);
        setTasks(rowsRef.current);
      }
    };
    window.addEventListener("agendal:task-created", onTaskCreated);
    window.addEventListener("agendal:task-deleted", onTaskDeleted);
    return () => {
      window.removeEventListener("agendal:task-created", onTaskCreated);
      window.removeEventListener("agendal:task-deleted", onTaskDeleted);
    };
  }, []);

  const replaceRow = useCallback((id: string, row: Task) => {
    rowsRef.current = rowsRef.current.map((t) => (t.id === id ? row : t));
    setTasks(rowsRef.current);
  }, []);

  const getTask = useCallback(
    (id: string) => rowsRef.current.find((t) => t.id === id),
    [],
  );

  const acceptOccurrence = useCallback((task: Task, remove: boolean) => {
    if (remove) {
      rowsRef.current = rowsRef.current.filter((row) => row.id !== task.id);
      syncState.current.confirmed.delete(task.id);
      syncState.current.writers.delete(task.id);
    } else if (!rowsRef.current.some((row) => row.id === task.id)) {
      rowsRef.current = [...rowsRef.current, task];
      syncState.current.confirmed.set(task.id, task);
    }
    setTasks(rowsRef.current);
  }, []);

  const removeRow = useCallback((id: string) => {
    rowsRef.current = rowsRef.current.filter((row) => row.id !== id);
    syncState.current.confirmed.delete(id);
    syncState.current.writers.delete(id);
    setTasks(rowsRef.current);
  }, []);

  const insertRow = useCallback((task: Task) => {
    if (!rowsRef.current.some((row) => row.id === task.id)) {
      rowsRef.current = [...rowsRef.current, task];
      syncState.current.confirmed.set(task.id, task);
    } else {
      rowsRef.current = rowsRef.current.map((row) =>
        row.id === task.id ? task : row,
      );
      syncState.current.confirmed.set(task.id, task);
    }
    setTasks(rowsRef.current);
  }, []);

  const change = useCallback(
    (
      id: string,
      fields: Partial<Task>,
      request: TaskSaveRequest,
      onError?: TaskSaveErrorCallback,
    ) => {
      const seq = (taskSeq.current.get(id) ?? 0) + 1;
      taskSeq.current.set(id, seq);

      const currentRow = rowsRef.current.find((t) => t.id === id);
      if (currentRow) {
        const { row: nextRow } = beginChange(
          syncState.current,
          currentRow,
          seq,
          fields,
        );
        replaceRow(id, nextRow);
      }

      const prev = taskQueue.current.get(id) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          try {
            const saved = await request();
            const row = rowsRef.current.find((t) => t.id === id);
            if (!row) return;
            const { row: nextRow } = settleSuccess(
              syncState.current,
              row,
              seq,
              saved,
            );
            replaceRow(id, nextRow);
          } catch (error) {
            const row = rowsRef.current.find((t) => t.id === id);
            if (!row) return;
            const { row: nextRow, rolledBack } = settleFailure(
              syncState.current,
              row,
              seq,
              fields,
            );
            replaceRow(id, nextRow);
            if (rolledBack) {
              onError?.(error);
            }
          }
        })
        .finally(() => {
          if (taskQueue.current.get(id) === next) {
            taskQueue.current.delete(id);
          }
        });

      taskQueue.current.set(id, next);
    },
    [replaceRow],
  );

  return { tasks, change, getTask, acceptOccurrence, removeRow, insertRow };
}
