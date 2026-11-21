import type { ReactNode } from "react";
import { today } from "../../../lib/clock";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import type { DeleteScope, TaskApi, TaskUpdateFn } from "../../domain/api";
import type { Project, Task, TimeFormat } from "../../domain/types";
import { saveErrorMessage } from "./saveError";
import type { UseTaskSyncReturn } from "./useTaskSync";

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

export type SettleSet = ReadonlySet<string>;
export type SettleTimerMap = Map<string, ReturnType<typeof setTimeout>>;
export type LifecycleAction = "complete" | "reopen";
export type LifecycleFn = (id: string, action: LifecycleAction) => void;
export type ToastDraft = Omit<ToastData, "id">;

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
  /** A done repeat unticked in Completed, its row leaving to go back into the series (#168). */
  isLeaving: (id: string) => boolean;
  /** The series' open row a done repeat just went back into, lit up for a moment. */
  isArriving: (id: string) => boolean;
  completedToday: (task: Task) => boolean;
  /** A row's tick in a list: a done repeat unticked goes back into its series (#168). */
  toggle: (task: Task) => void;
  /** Task details' tick: reopens or completes this task in place, never removing it. */
  toggleInPlace: (task: Task) => void;
  /** Adds a task loaded by id, e.g. one opened from Search. */
  ensureTask: (task: Task) => void;
  change: UseTaskSyncReturn["change"];
  update: TaskUpdateFn;
  /** Soft-deletes a task with a toast offering Undo (TK-5). Repeating tasks need a scope (TK-4). */
  remove: (task: Task, scope?: DeleteScope) => void;
  /** Restores a deleted task (Undo action) */
  restore: (task: Task, madeNextId?: string) => void;
  setProjects: (update: (projects: Project[]) => Project[]) => void;
}

export interface TaskStoreProviderProps {
  api: TaskApi;
  clock: Clock;
  initialTasks: Task[];
  initialProjects: Project[];
  timeFormat?: TimeFormat;
  /** Sends toasts to the app's toast, for a screen that closes right after one (task details). */
  onToast?: (draft: ToastDraft) => void;
  /**
   * Unticking a done repeat plays its rise-and-fade and the open row's swipe (#168): on a
   * project's page only, where Completed sits right under the open list. Elsewhere the rows just
   * change, and the toast says what happened.
   */
  mergeMotion?: boolean;
  children: ReactNode;
}

export function formatSaveErrorToast(
  error: unknown,
  retry: () => void,
): Omit<ToastData, "id"> {
  const result = saveErrorMessage(error);
  if (!result.retry) {
    return { message: result.message };
  }
  return {
    message: result.message,
    actionLabel: t("common.retry"),
    onAction: retry,
  };
}

export { saveErrorMessage, type SaveErrorMessageResult } from "./saveError";
export type { TaskUpdateFn };
