import type { Task } from "./types";

export interface TaskApi {
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }>;
  /** `POST /tasks/{id}/reopen`; also removes a next occurrence this completion made (TK-E6). */
  reopen(
    id: string,
    at: string,
  ): Promise<{ task: Task; removedNextId?: string }>;
}
