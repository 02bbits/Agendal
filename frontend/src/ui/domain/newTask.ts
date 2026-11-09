import { addDays, startOfWeek } from "./dates";
import type { Priority, Repeat } from "./types";

export type DueChip = "today" | "tomorrow" | "next_week" | "none" | "pick";

export interface NewTaskDefaults {
  chip: DueChip;
  projectId?: string;
}

/**
 * Resolves chip and picked date for an initial due date.
 */
export function chipForDate(
  date: string,
  today: string,
): { chip: DueChip; picked: string } {
  if (date === today) {
    return { chip: "today", picked: "" };
  }
  if (date === addDays(today, 1)) {
    return { chip: "tomorrow", picked: "" };
  }
  return { chip: "pick", picked: date };
}

export interface CreateTaskInput {
  id: string;
  title: string;
  dueDate?: string | null;
  dueTime?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  priority?: Priority;
  projectId?: string | null;
  repeat?: Repeat;
}

export interface CreateTaskBody {
  id: string;
  title: string;
  start_date?: string;
  due_date?: string;
  start_time?: string;
  due_time?: string;
  priority?: Priority;
  project_id?: string;
  repeat?: Repeat;
}

/**
 * Computes the due date string for a selected due chip.
 * NC §2.5, NU-E10.
 */
export function dueDateFor(
  chip: DueChip,
  today: string,
  picked?: string,
): string | null {
  switch (chip) {
    case "today":
      return today;
    case "tomorrow":
      return addDays(today, 1);
    case "next_week": {
      let nextDay = "mon";
      try {
        if (typeof localStorage !== "undefined") {
          const stored = localStorage.getItem("agendal.next_week_day");
          if (stored) nextDay = stored;
        }
      } catch {}
      if (nextDay === "sun") {
        return startOfWeek(addDays(today, 7), "sun");
      }
      if (nextDay === "sat") {
        return addDays(startOfWeek(addDays(today, 7), "mon"), 5);
      }
      return startOfWeek(addDays(today, 7), "mon");
    }
    case "none":
      return null;
    case "pick":
      return picked ?? null;
  }
}

/**
 * Returns default due chip and project based on where the sheet was opened.
 * NC §2.5 table.
 */
export function defaultsFor(pathname: string): NewTaskDefaults {
  if (pathname === "/") {
    return { chip: "today" };
  }
  if (pathname === "/upcoming") {
    return { chip: "tomorrow" };
  }
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (match && match[1]) {
    if (match[1] === "none") {
      return { chip: "none" };
    }
    return { chip: "none", projectId: match[1] };
  }
  return { chip: "none" };
}

/**
 * Default priority follows the NU rule: "medium" when due today, else "low".
 */
export function defaultPriority(
  dueDate: string | null,
  today: string,
): "medium" | "low" {
  return dueDate === today ? "medium" : "low";
}

/**
 * Builds the `POST /tasks` payload: trimmed title, omitting nulls/undefined.
 * A time is only sent with its date (TK §8).
 */
export function createBody({
  id,
  title,
  dueDate,
  dueTime,
  startDate,
  startTime,
  priority,
  projectId,
  repeat,
}: CreateTaskInput): CreateTaskBody {
  const body: CreateTaskBody = {
    id,
    title: title.trim(),
  };
  if (startDate) {
    body.start_date = startDate;
    if (startTime) body.start_time = startTime;
  }
  if (dueDate) {
    body.due_date = dueDate;
    if (dueTime) body.due_time = dueTime;
  }
  if (priority) {
    body.priority = priority;
  }
  if (projectId) {
    body.project_id = projectId;
  }
  if (repeat && repeat !== "never") {
    body.repeat = repeat;
  }
  return body;
}
