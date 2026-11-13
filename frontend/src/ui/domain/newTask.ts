import { addDays, startOfWeek } from "./dates";
import type { Priority, Reminder, Repeat } from "./types";

export type DueChip = "today" | "tomorrow" | "next_week" | "none" | "pick";

export interface NewTaskDefaults {
  chip: DueChip;
  projectId?: string;
}

/**
 * Resolves chip and picked date for an initial date (the start date since #154).
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
  repeatRule?: string | null;
  reminder?: Reminder;
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
  repeat_rule?: string;
  reminder?: Reminder;
}

/**
 * Computes the date for a date chip. New task uses it for the start date (#154); the date
 * picker's quick choices use it too. NC §2.5, NU-E10.
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
 * Returns the default date chip (the start date since #154) and project for where the sheet
 * was opened. NC §2.5 table.
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
 * Default priority: "medium" when the task starts today, else "low" (it followed the due date
 * before #154).
 */
export function defaultPriority(
  startDate: string | null,
  today: string,
): "medium" | "low" {
  return startDate === today ? "medium" : "low";
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
  repeatRule,
  reminder,
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
    if (repeatRule) body.repeat_rule = repeatRule;
  }
  if (reminder && reminder !== "none") {
    body.reminder = reminder;
  }
  return body;
}
