import type { CopyKey } from "../copy";
import type { OrderField } from "./order";
import type { SearchFilter } from "./search";
import type { Task } from "./types";

/** What complete and reopen answer. */
export interface LifecycleResult {
  task: Task;
  /** Complete: the next occurrence. Reopen: the occurrence its completion made, now removed. */
  next?: Task;
  /** Reopen: every later open occurrence of the series, removed (one open per series). */
  withdrawn?: string[];
  /** Reopen: earlier occurrences that were open, back to done. */
  closed?: Task[];
  /** Reopen with `merge`: removed, since its series still has an open occurrence. */
  merged?: boolean;
}

export type TaskRequest = () => Promise<LifecycleResult>;
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
    | "due_reminder"
    | "repeat"
    | "repeat_rule"
    | "notes"
    | "project_id"
    | "project_order"
    | "day_order"
  >
>;

export type DeleteScope = "one" | "future";

/** One manual-order key to write (#178); null takes the task out of manual order. */
export interface OrderRow {
  id: string;
  field: OrderField;
  value: string | null;
}

export interface TaskApi {
  /** `POST /tasks/{id}/complete` → the task, and the next occurrence for a repeating task. */
  complete(id: string, at: string): ReturnType<TaskRequest>;
  /** `POST /tasks/{id}/reopen` → the task, and the other occurrences of its series that changed. */
  reopen(
    id: string,
    at: string,
    options?: { merge?: boolean },
  ): ReturnType<TaskRequest>;
  /** `PATCH /tasks/{id}` → the updated task. */
  patch(id: string, fields: TaskPatch, at: string): PatchTaskResponse;
  /** Manual-order keys (#178), sent together as one `POST /sync/patches` batch. */
  reorder?(rows: OrderRow[], at: string): Promise<void>;
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
