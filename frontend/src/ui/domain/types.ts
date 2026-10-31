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
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  /** null when no priority was set (the API contract allows it); shown like Low. */
  priority: Priority | null;
  project_id: string | null;
  repeat: Repeat;
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
