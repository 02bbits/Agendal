import { localTime, now, timeZone, today } from "../../lib/clock";
import type { CopyKey } from "../copy";
import type { TaskPatch, TaskUpdateErrors } from "./api";
import { addDays } from "./dates";
import type { Reminder, Task } from "./types";

export const TITLE_MAX = 200;
export const NOTES_MAX = 5000;

/**
 * Formats an ISO instant into floating local date (YYYY-MM-DD) and time (HH:mm)
 * in the given time zone (ADR-006).
 */
export function localDateTime(
  instant: string,
  zone: string,
): { date: string; time: string } {
  const d = new Date(instant);
  return {
    date: today(zone, d),
    time: localTime(zone, d),
  };
}

/** TK-3, BR-11: start (date and time) must be before due (date and time); also a DB CHECK. */
export function startAfterDue(
  task: Pick<Task, "start_date" | "start_time" | "due_date" | "due_time">,
): "start_date" | "start_time" | null {
  if (task.start_date && task.due_date) {
    if (task.start_date > task.due_date) {
      return "start_date";
    }
    if (
      task.start_date === task.due_date &&
      task.start_time &&
      task.due_time &&
      task.start_time >= task.due_time
    ) {
      return "start_time";
    }
  }
  return null;
}

/**
 * Applies the field rules of TK §2.2 to a patch, returning the full set of
 * fields that change:
 * - a start time with no start date → start_date = due ?? todayDate
 * - a due time with no due date → due_date = todayDate
 * - a repeat (≠ never) with neither date → due_date = todayDate
 * - clearing the start date → start_time = null; and if no due date → reminder = "none", repeat = "never"
 * - clearing the due date → due_time = null; and if no start date → reminder = "none", repeat = "never"
 * Fields equal to the current value are dropped, so no empty patch is sent (TK-E16).
 */
export function normalizePatch(
  task: Task,
  patch: TaskPatch,
  todayDate: string,
): TaskPatch {
  const next: TaskPatch = { ...patch };

  if ("title" in next && next.title !== undefined) {
    next.title = next.title.trim();
  }
  if ("notes" in next) {
    next.notes = next.notes?.trim() ? next.notes : null;
  }

  let start = "start_date" in next ? next.start_date : task.start_date;
  let due = "due_date" in next ? next.due_date : task.due_date;

  if ("start_date" in next && !next.start_date) {
    next.start_time = null;
    if (!due) {
      next.reminder = "none";
      next.repeat = "never";
    }
  }
  if ("due_date" in next && !next.due_date) {
    next.due_time = null;
    if (!start) {
      next.reminder = "none";
      next.repeat = "never";
    }
  }

  const startTime = "start_time" in next ? next.start_time : task.start_time;
  const dueTime = "due_time" in next ? next.due_time : task.due_time;
  const repeat = "repeat" in next ? next.repeat : task.repeat;

  if (!start && startTime) {
    next.start_date = due ?? todayDate;
    start = next.start_date;
  }
  if (!due && dueTime) {
    next.due_date = todayDate;
    due = next.due_date;
  }
  if (!due && !start && repeat && repeat !== "never") {
    next.due_date = todayDate;
    due = next.due_date;
  }

  for (const key of Object.keys(next) as Array<keyof TaskPatch>) {
    if (next[key] === task[key]) {
      delete next[key];
    }
  }
  return next;
}

/** Validates a normalized patch against the task; returns field errors as copy keys. */
export function patchErrors(task: Task, patch: TaskPatch): TaskUpdateErrors {
  const merged = { ...task, ...patch };
  const errors: TaskUpdateErrors = {};
  if ("title" in patch && !merged.title) {
    errors.title = "task.title_required";
  }
  const field = startAfterDue(merged);
  if (field) {
    errors[field] = "task.start_after_due";
  }
  if (merged.reminder !== "none" && !merged.start_date && !merged.due_date) {
    errors.reminder = "task.reminder_needs_date";
  }
  return errors;
}

const OFFSET_MINUTES: Record<Exclude<Reminder, "none">, number> = {
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "1d": 1440,
};

/**
 * The local date-time a reminder fires: the offset before the start date and time
 * when set, else before the due date and time (defaulting to 09:00 when there is no
 * time) (BR-12). Null without one.
 */
export function reminderAt(
  task: Pick<
    Task,
    "start_date" | "start_time" | "due_date" | "due_time" | "reminder"
  >,
): string | null {
  if (task.reminder === "none") return null;
  let date: string;
  let time: string;
  if (task.start_date) {
    date = task.start_date;
    time = task.start_time ?? "09:00";
  } else if (task.due_date) {
    date = task.due_date;
    time = task.due_time ?? "09:00";
  } else {
    return null;
  }

  const [h, m] = time.split(":").map(Number) as [number, number];
  let minutes = h * 60 + m - OFFSET_MINUTES[task.reminder];
  while (minutes < 0) {
    minutes += 1440;
    date = addDays(date, -1);
  }
  return `${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Whether the reminder time has already passed (BR-12, TK-E4).
 */
export function reminderPast(
  task: Pick<
    Task,
    "start_date" | "start_time" | "due_date" | "due_time" | "reminder"
  >,
  at: Date = now(),
  zone: string = timeZone(),
): boolean {
  const fires = reminderAt(task);
  if (!fires) return false;
  const current = `${today(zone, at)}T${localTime(zone, at)}`;
  return fires < current;
}
