// Task and project resources, matching the API and the shared NotePlan schema
// (docs/07-architecture/data-model.md, packages/contracts). Dates are floating
// local `YYYY-MM-DD`, times `HH:MM` (ADR-006).

export type Priority = "low" | "medium" | "high";
export type Repeat = "never" | "daily" | "weekly" | "monthly" | "yearly";
export type Reminder = "none" | "5m" | "15m" | "30m" | "1h" | "1d";

export const PRIORITIES: readonly Priority[] = ["low", "medium", "high"];
export const REPEATS: readonly Repeat[] = [
  "never",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];
export const REMINDERS: readonly Reminder[] = [
  "none",
  "5m",
  "15m",
  "30m",
  "1h",
  "1d",
];
export type ProjectColor =
  "blue" | "red" | "orange" | "yellow" | "green" | "teal" | "purple" | "gray";

export interface Task {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  start_time: string | null;
  due_time: string | null;
  /** null when no priority was set (the API contract allows it); shown like Low. */
  priority: Priority | null;
  project_id: string | null;
  repeat: Repeat;
  repeat_rule?: string | null;
  reminder: Reminder;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  created_by: "user" | "assistant";
  source_note_id?: string | null;
  created_at: string;
  updated_at?: string;
  repeat_anchor?: string | null;
  previous_occurrence_id?: string | null;
}

export interface Project {
  id: string;
  name: string;
  colour: ProjectColor;
  created_at: string;
}

export type TimeFormat = "24h" | "12h";
export type WeekStart = "mon" | "sun";

/** One applied change of a note (NU §7). `label` is what the result row shows, `was` the old value of an update. */
export interface NoteChange {
  kind: "created" | "updated" | "deleted";
  task: Task;
  label: string;
  /** The plan entry it comes from; Check this first sends edits by it (RV §7). */
  ref?: string;
  was?: string;
}

/** Text the note made no task from, and why (NU §7). */
export interface SkippedItem {
  ref: string;
  text: string;
  reason: "skip" | "already_done" | "not_found" | "no_change";
}

/** The part of a note result (`POST /notes`, `GET /notes/{id}`, NU §7) the app reads so far. */
export interface NoteResult {
  note: {
    id: string;
    client_id: string;
    status: "done" | "confirm" | "followup" | "pending";
    name: string | null;
    text: string;
    source_file_name: string | null;
    written_at: string;
    processed_at: string;
    edited_at?: string | null;
  };
  changes: NoteChange[];
  skipped: SkippedItem[];
  /** Only after Undo all: redo is allowed until then (RV §7) */
  redo_until?: string;
}

export type NoteFilter = "all" | "made" | "needs";
export interface NoteListEntry {
  id: string;
  status: NoteResult["note"]["status"];
  name: string | null;
  excerpt: string;
  written_at: string;
  edited_at?: string | null;
  source_file_name: string | null;
  counts: { created: number; updated: number; deleted: number };
}
