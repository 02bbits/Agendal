import type { TaskPatch } from "./api";
import { addDays, daysBetween } from "./dates";
import type { Task } from "./types";

/** The Inbox sections a task can be dropped into (Spec 02 §3). */
export type InboxSection = "overdue" | "today" | "no_date" | "completed";

export type ReceivePatch = TaskPatch & { done?: boolean };

/**
 * What dropping a task into an Inbox section changes (Spec 02 §3), or null when the drop
 * means nothing (the task is already there, or Overdue, which only time puts a task in).
 * Times are kept; moving a span keeps its length, so start stays before due (TK-3).
 */
export function inboxDropPatch(
  task: Task,
  to: InboxSection,
  today: string,
): ReceivePatch | null {
  const { start_date: start, due_date: due, done } = task;
  if (to === "completed") {
    return done ? null : { done: true };
  }
  const uncompletePatch: ReceivePatch = done ? { done: false } : {};
  if (to === "no_date") {
    if (done) return { ...uncompletePatch, start_date: null, due_date: null };
    return start || due ? { start_date: null, due_date: null } : null;
  }
  if (to !== "today") return null;
  if (done) {
    return { ...uncompletePatch, due_date: due && due >= today ? due : today };
  }
  if (!start && !due) return { due_date: today };
  if (due && due < today) {
    const shift = daysBetween(due, today);
    return start
      ? { start_date: addDays(start, shift), due_date: today }
      : { due_date: today };
  }
  return null;
}

/** The patch rule for drops into one Inbox section, ready for a list. */
export const dropIntoSection =
  (to: InboxSection, today: string) =>
  (task: Task): TaskPatch | null =>
    inboxDropPatch(task, to, today);

/** The patch rule for drops onto one Upcoming day (from another day's list, `day:{date}`, or `overdue`). */
export const dropOntoDay =
  (day: string) =>
  (task: Task, from: string): TaskPatch | null => {
    if (from.startsWith("day:")) {
      return dayDropPatch(task, from.slice(4), day);
    }
    if (from === "overdue") {
      const fromDay = task.start_date ?? task.due_date;
      if (fromDay && fromDay !== day) {
        return dayDropPatch(task, fromDay, day);
      }
      return task.start_date
        ? { start_date: day, due_date: day }
        : { due_date: day };
    }
    return null;
  };

/**
 * What dropping a task's entry from one Upcoming day onto another changes (Spec 02 §3):
 * its start day moves, or its due day for a task with no start. When both start and due
 * exist, both move by the same number of days so the span keeps its length.
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
    if (due) patch.due_date = addDays(due, shift);
    return patch;
  }
  if (!start && due === from) return { due_date: to };
  return null;
}
