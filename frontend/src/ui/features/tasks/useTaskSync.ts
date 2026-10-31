import { useCallback, useRef, useState, type ReactNode } from "react";
import { ApiRequestError } from "../../../lib/apiError";
import type { ToastData } from "../../components/Toast";
import { t, type CopyKey } from "../../copy";
import { catalog } from "../../copy/catalog";
import { pending } from "../../copy/pending";
import type { TaskApi } from "../../domain/api";
import {
  beginChange,
  createTaskSyncState,
  settleFailure,
  settleSuccess,
  type TaskSyncState,
} from "../../domain/sync";
import type { Project, Task, TimeFormat } from "../../domain/types";
import { today } from "../../../lib/clock";

export function isTaskCompletedToday(
  task: Task,
  timeZone: string,
  todayDate: string,
): boolean {
  return Boolean(
    task.done_at && today(timeZone, new Date(task.done_at)) === todayDate,
  );
}

/** Injected clock (IM-05 / ADR-006): no screen reads the system time directly. */
export interface Clock {
  now(): Date;
  timeZone: string;
}

/** A ticked row stays in place this long before it moves to the completed area (TK §2.1). */
export const SETTLE_MS = 600;

export type TaskSaveRequest = () => Promise<Task>;
export type TaskSaveErrorCallback = (error: unknown) => void;
export type SettleTimerMap = Map<string, ReturnType<typeof setTimeout>>;
export type LifecycleAction = "complete" | "reopen";
export type LifecycleFn = (id: string, action: LifecycleAction) => void;

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

export interface TaskStore {
  tasks: Task[];
  projects: Project[];
  today: string;
  timeFormat: TimeFormat;
  clock: Clock;
  api: TaskApi;
  toast: ToastData | null;
  showToast: (toast: Omit<ToastData, "id">) => void;
  dismissToast: (id: ToastData["id"]) => void;
  projectOf: (task: Task) => Project | null;
  isSettling: (id: string) => boolean;
  completedToday: (task: Task) => boolean;
  toggle: (task: Task) => void;
  change: UseTaskSyncReturn["change"];
  setProjects: (update: (projects: Project[]) => Project[]) => void;
}

export interface TaskStoreProviderProps {
  api: TaskApi;
  clock: Clock;
  initialTasks: Task[];
  initialProjects: Project[];
  timeFormat?: TimeFormat;
  children: ReactNode;
}

export function isCatalogCode(code: string): code is CopyKey {
  return code in catalog || code in pending;
}

export function formatSaveErrorToast(
  error: unknown,
  retry: () => void,
): Omit<ToastData, "id"> {
  if (
    error instanceof ApiRequestError &&
    error.status < 500 &&
    error.code !== "error.generic" &&
    isCatalogCode(error.code)
  ) {
    return { message: t(error.code) };
  }
  return {
    message: t("error.save_failed"),
    actionLabel: t("common.retry"),
    onAction: retry,
  };
}

export function useTaskSync(initialTasks: Task[]): UseTaskSyncReturn {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const rowsRef = useRef<Task[]>(initialTasks);
  const syncState = useRef<TaskSyncState>(createTaskSyncState(initialTasks));
  const taskSeq = useRef<Map<string, number>>(new Map());
  const taskQueue = useRef<Map<string, Promise<unknown>>>(new Map());

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
        rowsRef.current = rowsRef.current.map((t) =>
          t.id === id ? nextRow : t,
        );
        setTasks(rowsRef.current);
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
            rowsRef.current = rowsRef.current.map((t) =>
              t.id === id ? nextRow : t,
            );
            setTasks(rowsRef.current);
          } catch (error) {
            const row = rowsRef.current.find((t) => t.id === id);
            if (!row) return;
            const { row: nextRow, rolledBack } = settleFailure(
              syncState.current,
              row,
              seq,
              fields,
            );
            rowsRef.current = rowsRef.current.map((t) =>
              t.id === id ? nextRow : t,
            );
            setTasks(rowsRef.current);
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
    [],
  );

  return { tasks, change, getTask };
}
