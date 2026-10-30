import type { Task } from "./types";

export type TaskRequest = () => Promise<{ task: Task; next?: Task }>;

export interface TaskApi {
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): ReturnType<TaskRequest>;
  /** `POST /tasks/{id}/reopen` → the task, and the next occurrence for a repeating task. */
  reopen(id: string, at: string): ReturnType<TaskRequest>;
}
