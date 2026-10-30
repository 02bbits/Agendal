import type { Task } from "./types";

export interface TaskApi {
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }>;
  /** `POST /tasks/{id}/reopen` → the task, and the next occurrence for a repeating task. */
  reopen(id: string, at: string): Promise<{ task: Task; next?: Task }>;
}
