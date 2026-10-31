import { useCallback, useRef, useState } from "react";
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
}

export function useTaskSync(initialTasks: Task[]): UseTaskSyncReturn {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const rowsRef = useRef<Task[]>(initialTasks);
  const syncState = useRef<TaskSyncState>(createTaskSyncState(initialTasks));
  const taskSeq = useRef<Map<string, number>>(new Map());
  const taskQueue = useRef<Map<string, Promise<unknown>>>(new Map());

  const replaceRow = useCallback((id: string, row: Task) => {
    rowsRef.current = rowsRef.current.map((t) => (t.id === id ? row : t));
    setTasks(rowsRef.current);
  }, []);

  const getTask = useCallback(
    (id: string) => rowsRef.current.find((t) => t.id === id),
    [],
  );

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

  return { tasks, change, getTask };
}
