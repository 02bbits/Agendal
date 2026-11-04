import { sortWithinDay, type UpcomingFilter } from "./lists";
import type { Task } from "./types";

export type EntryKind = "start" | "due";

export interface DayEntry {
  task: Task;
  kind: EntryKind;
  date: string;
}

export function entriesOf(task: Task): DayEntry[] {
  const hasStart = Boolean(task.start_date);
  const hasDue = Boolean(task.due_date);

  if (!hasStart && !hasDue) {
    return [];
  }
  if (hasStart && hasDue) {
    if (task.start_date === task.due_date) {
      return [{ task, kind: "due", date: task.due_date! }];
    }
    return [
      { task, kind: "start", date: task.start_date! },
      { task, kind: "due", date: task.due_date! },
    ];
  }
  if (hasDue) {
    return [{ task, kind: "due", date: task.due_date! }];
  }
  return [{ task, kind: "start", date: task.start_date! }];
}

export function matchesEntry(entry: DayEntry, filter: UpcomingFilter): boolean {
  if (filter === "all") return true;
  if (filter === "scheduled") {
    return (
      Boolean(entry.task.start_date) &&
      (entry.kind === "start" || entry.task.start_date === entry.task.due_date)
    );
  }
  if (filter === "due") {
    return entry.kind === "due";
  }
  return true;
}

/** Scheduled is about starts, so a same-day task is a normal card there, not a due one. */
export function entryForFilter(
  entry: DayEntry,
  filter: UpcomingFilter,
): DayEntry {
  return filter === "scheduled" ? { ...entry, kind: "start" } : entry;
}

function sortEntryList(list: DayEntry[]): DayEntry[] {
  if (list.length <= 1) return [...list];
  const sortedTasks = sortWithinDay(list.map((e) => e.task));
  const byId = new Map(list.map((e) => [e.task.id, e]));
  return sortedTasks.map((t) => byId.get(t.id)!);
}

export function sortEntries(entries: DayEntry[]): {
  normal: DayEntry[];
  due: DayEntry[];
} {
  const normalEntries = entries.filter((e) => e.kind === "start");
  const dueEntries = entries.filter((e) => e.kind === "due");

  return {
    normal: sortEntryList(normalEntries),
    due: sortEntryList(dueEntries),
  };
}
