import type { CopyKey } from "../copy";
import type { SearchFilter } from "./search";
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
    | "start_date"
    | "due_date"
    | "start_time"
    | "due_time"
    | "priority"
    | "reminder"
    | "repeat"
    | "repeat_rule"
    | "notes"
    | "project_id"
  >
>;

export type DeleteScope = "one" | "future";

export interface TaskApi {
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): ReturnType<TaskRequest>;
  /** `POST /tasks/{id}/reopen` → the task, and the generated occurrence removed by Undo. */
  reopen(id: string, at: string): ReturnType<TaskRequest>;
  /** `PATCH /tasks/{id}` → the updated task. */
  patch(id: string, fields: TaskPatch, at: string): PatchTaskResponse;
  /** `DELETE /tasks/{id}?scope=one|future` (soft delete). */
  remove(id: string, scope?: DeleteScope): Promise<{ next?: Task } | void>;
  /** `POST /tasks/{id}/restore`: the toast's Undo after a delete. */
  restore(id: string): Promise<Task>;
  /** `GET /tasks/{id}`: a task that isn't in the list on screen, e.g. opened from Search. */
  get?(id: string): Promise<Task>;
  /** `GET /tasks/search?q=&status=&cursor=`: search titles and notes (LV-3). */
  search?(params: {
    q?: string;
    status?: "all" | "open" | "completed";
    cursor?: string;
    filter?: SearchFilter;
    project_id?: string;
  }): Promise<{
    items: Task[];
    counts: { all: number; open: number; completed: number };
    next_cursor: string | null;
  }>;
}
