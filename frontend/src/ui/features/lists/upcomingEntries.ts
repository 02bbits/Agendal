import {
  entriesOf,
  entryForFilter,
  matchesEntry,
  type DayEntry,
} from "../../domain/entries";
import type { UpcomingFilter } from "../../domain/lists";
import type { Task } from "../../domain/types";

/**
 * Each day's entries (a task's start and due days) under the filter, and how many fall on each
 * day of the strip. Done tasks drop out once they have settled.
 */
export function groupUpcomingEntries(
  tasks: readonly Task[],
  renderedDays: string[],
  stripDays: string[],
  filter: UpcomingFilter,
  isSettling: (id: string) => boolean,
): {
  entriesByDay: Record<string, DayEntry[]>;
  countsByDay: Record<string, number>;
} {
  const entriesByDay: Record<string, DayEntry[]> = {};
  const countsByDay: Record<string, number> = {};
  for (const d of stripDays) countsByDay[d] = 0;
  for (const d of renderedDays) {
    entriesByDay[d] = [];
    countsByDay[d] = 0;
  }
  for (const task of tasks) {
    if (task.done && !isSettling(task.id)) continue;
    const entries = entriesOf(task);
    for (const entry of entries) {
      if (!matchesEntry(entry, filter)) continue;
      if (!entriesByDay[entry.date]) entriesByDay[entry.date] = [];
      entriesByDay[entry.date].push(entryForFilter(entry, filter));
      countsByDay[entry.date] = (countsByDay[entry.date] ?? 0) + 1;
    }
  }
  return { entriesByDay, countsByDay };
}
