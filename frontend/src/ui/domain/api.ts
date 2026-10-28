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

/** `POST /tasks` body: a client UUID v7 plus the fields set (TK §7). Replaying a known id is a no-op `200`. */
export type NewTask = Pick<Task, "id" | "title"> & TaskPatch;

export interface TaskApi {
  create(task: NewTask): Promise<Task>;
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): Promise<{ task: Task; next?: Task }>;
  /** `POST /tasks/{id}/reopen`; also removes a next occurrence this completion made (TK-E6). */
  reopen(
    id: string,
    at: string,
  ): Promise<{ task: Task; removedNextId?: string }>;
  /** `GET /tasks/{id}`. */
  get(id: string): Promise<Task>;
  /** `PATCH /tasks/{id}` with only the changed fields, each stamped with `at` (ADR-004). */
  patch(id: string, patch: TaskPatch, at: string): Promise<Task>;
  /**
   * `DELETE /tasks/{id}?scope=one|future` (soft delete). For a repeating task,
   * `one` deletes this occurrence and returns the next one so the series goes on.
   */
  remove(id: string, scope?: DeleteScope): Promise<{ next?: Task }>;
  /** `POST /tasks/{id}/restore`: the toast's Undo after a delete. */
  restore(id: string): Promise<Task>;
}
