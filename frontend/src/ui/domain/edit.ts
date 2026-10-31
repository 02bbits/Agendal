import { localTime, now, timeZone, today } from "../../lib/clock";
import type { CopyKey } from "../copy";
import type { TaskPatch, TaskUpdateErrors } from "./api";
import { addDays } from "./dates";
import type { Reminder, Task } from "./types";

export const TITLE_MAX = 200;
export const NOTES_MAX = 5000;

/** TK-3: an end not after the start is an error (also a DB CHECK). */
export function scheduleError(
  start: string | null | undefined,
  end: string | null | undefined,
): CopyKey | null {
  return start && end && end <= start ? "task.end_before_start" : null;
}

/**
 * Applies the field rules of TK §2.2 to a patch, returning the full set of
 * fields that change:
 * - a start (or a repeat) with no due date sets the due date to today
 * - clearing the start clears the end
 * - clearing the due date clears start, end and reminder
 * Fields equal to the current value are dropped, so no empty patch is sent (TK-E16).
 */
export function normalizePatch(
  task: Task,
  patch: TaskPatch,
  todayDate: string,
): TaskPatch {
  const next: TaskPatch = { ...patch };
  const due = "due_date" in next ? next.due_date : task.due_date;

  if ("title" in next && next.title !== undefined) {
    next.title = next.title.trim();
  }
  if ("notes" in next) {
    next.notes = next.notes?.trim() ? next.notes : null;
  }
  if (
    !due &&
    ((next.start_time ?? null) !== null ||
      (next.repeat && next.repeat !== "never"))
  ) {
    next.due_date = todayDate;
  }
  if ("start_time" in next && !next.start_time) {
    next.end_time = null;
  }
  if ("due_date" in next && !next.due_date) {
    next.start_time = null;
    next.end_time = null;
    next.reminder = "none";
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
  const schedule = scheduleError(merged.start_time, merged.end_time);
  if (schedule) {
    errors.end_time = schedule;
  }
  if (merged.reminder !== "none" && !merged.due_date) {
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
 * The local date-time a reminder fires: the offset before the start time, or
 * before 09:00 on the due date when there is no time (BR-12). Null without one.
 */
export function reminderAt(
  task: Pick<Task, "due_date" | "start_time" | "reminder">,
): string | null {
  if (task.reminder === "none" || !task.due_date) return null;
  const [h, m] = (task.start_time ?? "09:00").split(":").map(Number) as [
    number,
    number,
  ];
  let minutes = h * 60 + m - OFFSET_MINUTES[task.reminder];
  let date = task.due_date;
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
  task: Pick<Task, "due_date" | "start_time" | "reminder">,
  at: Date = now(),
  zone: string = timeZone(),
): boolean {
  const fires = reminderAt(task);
  if (!fires) return false;
  const current = `${today(zone, at)}T${localTime(zone, at)}`;
  return fires < current;
}
