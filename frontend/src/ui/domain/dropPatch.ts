import type { TaskPatch } from "./api";
import { addDays, daysBetween } from "./dates";
import type { Task } from "./types";

/** The Inbox sections a task can be dropped into (Spec 02 §3). */
export type InboxSection = "overdue" | "today" | "no_date";

/**
 * What dropping a task into an Inbox section changes (Spec 02 §3), or null when the drop
 * means nothing (the task is already there, or Overdue, which only time puts a task in).
 * Times are kept; moving a span keeps its length, so start stays before due (TK-3).
 */
export function inboxDropPatch(
  task: Task,
  to: InboxSection,
  today: string,
): TaskPatch | null {
  const { start_date: start, due_date: due } = task;
  if (to === "no_date") {
    return start || due ? { start_date: null, due_date: null } : null;
  }
  if (to !== "today") return null;
  if (!start && !due) return { due_date: today };
  if (due && due < today) {
    const shift = daysBetween(due, today);
    return start
      ? { start_date: addDays(start, shift), due_date: today }
      : { due_date: today };
  }
  return null;
}

/**
 * What dropping a task's entry from one Upcoming day onto another changes (Spec 02 §3):
 * its start day moves, or its due day for a task with no start. A due day the new start
 * would pass moves by the same number of days, so the span keeps its length.
 */
export function dayDropPatch(
  task: Task,
  from: string,
  to: string,
): TaskPatch | null {
  if (from === to) return null;
  const shift = daysBetween(from, to);
  const { start_date: start, due_date: due } = task;
  if (start === from) {
    const patch: TaskPatch = { start_date: to };
    if (due && (due === from || to > due)) patch.due_date = addDays(due, shift);
    return patch;
  }
  if (!start && due === from) return { due_date: to };
  return null;
}
