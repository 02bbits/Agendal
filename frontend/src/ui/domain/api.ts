import type { Task } from "./types";

// Client side of the task and project endpoints (TK §7, PJ §7). The Laravel
// implementation (IM-20, IM-27) plugs in behind this; until then screens run
// on createMemoryApi().

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
export type DeleteScope = "one" | "future";
export type ProjectTaskAction = "move" | "delete";

export interface TaskApi {
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }>;
  /** `POST /tasks/{id}/reopen`; also removes a next occurrence this completion made (TK-E6). */
  reopen(
    id: string,
    at: string,
  ): Promise<{ task: Task; removedNextId?: string }>;
}
