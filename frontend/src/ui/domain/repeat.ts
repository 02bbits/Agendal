import { addDays, daysBetween, daysInMonth } from "./dates";
import type { Repeat, Task } from "./types";

/** The n-th date of a monthly or yearly series, with the anchor's day capped to the month (31 Jan → 28 Feb). */
function nthInSeries(
  anchor: string,
  repeat: "monthly" | "yearly",
  n: number,
): string {
  const [ay, am, ad] = anchor.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const months = repeat === "monthly" ? n : n * 12;
  const total = ay * 12 + (am - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(ad, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Next due date of a repeating task (TK §2.3): the first date in the series
 * after the current due date and on or after today. It comes from the due date,
 * not the completion date, and missed occurrences are skipped.
 */
export function nextDueDate(
  dueDate: string,
  repeat: Exclude<Repeat, "never">,
  today: string,
  anchor: string = dueDate,
): string {
  const floor = dueDate >= today ? addDays(dueDate, 1) : today;
  if (repeat === "daily") return floor;
  if (repeat === "weekly") {
    const weeks = Math.ceil(daysBetween(dueDate, floor) / 7);
    return addDays(dueDate, Math.max(1, weeks) * 7);
  }
  // Monthly and yearly count from the anchor so a capped day returns (31 Jan → 28 Feb → 31 Mar)
  let n = 1;
  let candidate = nthInSeries(anchor, repeat, n);
  while (candidate < floor) candidate = nthInSeries(anchor, repeat, ++n);
  return candidate;
}

/** Fields the next occurrence copies (TK §2.3). The server makes it; this mirrors it for offline and mocks. */
export function nextOccurrence(
  task: Task,
  today: string,
  id: string,
  now: string,
): Task | null {
  if (task.repeat === "never" || !task.due_date) return null;
  const anchor = task.repeat_anchor ?? task.due_date;
  return {
    ...task,
    id,
    due_date: nextDueDate(task.due_date, task.repeat, today, anchor),
    done: false,
    done_at: null,
    repeat_anchor: anchor,
    previous_occurrence_id: task.id,
    created_at: now,
    updated_at: now,
  };
}
