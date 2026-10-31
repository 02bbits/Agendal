import type { ReactNode } from "react";
import { ApiRequestError } from "../../../lib/apiError";
import { today } from "../../../lib/clock";
import type { ToastData } from "../../components/Toast";
import { isCopyKey, t } from "../../copy";
import type { TaskApi } from "../../domain/api";
import type { Project, Task, TimeFormat } from "../../domain/types";
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

export function formatSaveErrorToast(
  error: unknown,
  retry: () => void,
): Omit<ToastData, "id"> {
  if (
    error instanceof ApiRequestError &&
    error.status < 500 &&
    error.code !== "error.generic" &&
    isCopyKey(error.code)
  ) {
    return { message: t(error.code) };
  }
  return {
    message: t("error.save_failed"),
    actionLabel: t("common.retry"),
    onAction: retry,
  };
}
