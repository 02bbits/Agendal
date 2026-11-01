import type { CopyKey } from "../copy";
import type { Task } from "./types";

export type TaskRequest = () => Promise<{ task: Task; next?: Task }>;
export type PatchTaskResponse = Promise<Task>;
export type TaskUpdateErrors = Partial<Record<keyof TaskPatch, CopyKey>>;
export type TaskUpdateFn = (
  task: Task | string,
  raw: TaskPatch,
) => TaskUpdateErrors;

export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "due_date"
    | "start_time"
    | "end_time"
    | "priority"
    | "reminder"
    | "repeat"
    | "notes"
    | "project_id"
  >
>;

export interface TaskApi {
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): ReturnType<TaskRequest>;
  /** `POST /tasks/{id}/reopen` → the task, and the next occurrence for a repeating task. */
  reopen(id: string, at: string): ReturnType<TaskRequest>;
  /** `PATCH /tasks/{id}` → the updated task. */
  patch(id: string, fields: TaskPatch, at: string): PatchTaskResponse;
}
