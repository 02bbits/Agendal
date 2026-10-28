import { addDays } from "./dates";
import { inboxProgress, type Progress } from "./progress";
import type { Task } from "./types";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Within a day (Today, and each Upcoming day): timed by start, then untimed by priority, then created (LV §2.1). */
export function sortWithinDay(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.start_time && b.start_time)
      return (
        a.start_time.localeCompare(b.start_time) ||
        a.created_at.localeCompare(b.created_at)
      );
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return (
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.created_at.localeCompare(b.created_at)
    );
  });
}

export interface InboxView {
  overdue: Task[];
  today: Task[];
  noDate: Task[];
  completed: Task[];
  progress: Progress;
  /** No task at all: the first-run state instead of "Nothing left for today". */
  empty: boolean;
}

export interface ListOptions {
  completedToday: (task: Task) => boolean;
  /** A just-ticked task stays in its open section briefly (TK §2.1). */
  isSettling?: (id: string) => boolean;
}

/**
 * Inbox sections (LV-1): Overdue (oldest first) before Today, then No date
 * (priority, newest first) and tasks completed today. Overdue is by date only,
 * so a task due today whose time has passed stays in Today (LV-E9).
 */
export function buildInbox(
  tasks: readonly Task[],
  today: string,
  opts: ListOptions,
): InboxView {
  const settling = opts.isSettling ?? (() => false);
  const open = tasks.filter((t) => !t.done || settling(t.id));
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const noDate = open.filter((t) => !t.due_date);
  const completed = tasks.filter(
    (t) => t.done && !settling(t.id) && opts.completedToday(t),
  );
  return {
    overdue: [...overdue].sort(
      (a, b) =>
        a.due_date!.localeCompare(b.due_date!) ||
        a.created_at.localeCompare(b.created_at),
    ),
    today: sortWithinDay(dueToday),
    noDate: [...noDate].sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.created_at.localeCompare(a.created_at),
    ),
    completed: [...completed].sort((a, b) =>
      (b.done_at ?? "").localeCompare(a.done_at ?? ""),
    ),
    progress: inboxProgress(tasks, today, opts.completedToday),
    empty: tasks.length === 0,
  };
}

export type UpcomingFilter = "all" | "scheduled" | "due";

export interface UpcomingPage {
  days: Array<{ date: string; tasks: Task[] }>;
  /** Where the next page starts, or null when nothing more is due. */
  nextFrom: string | null;
}

/** Scheduled: has a start time. Due only: a due date and no start time (LV §2.2). */
export function matchesFilter(task: Task, filter: UpcomingFilter): boolean {
  if (filter === "scheduled") return !!task.start_time;
  if (filter === "due") return !task.start_time;
  return true;
}

/**
 * One page of Upcoming (LV-2): open tasks due from `from` on, grouped by day,
 * 14 days at a time. A long gap moves on to the next date with tasks; days with
 * nothing due aren't shown. Completed tasks aren't shown.
 */
export function upcomingPage(
  tasks: readonly Task[],
  from: string,
  filter: UpcomingFilter,
  days = 14,
  isSettling: (id: string) => boolean = () => false,
): UpcomingPage {
  const due = tasks
    .filter(
      (t) =>
        (!t.done || isSettling(t.id)) &&
        t.due_date &&
        t.due_date >= from &&
        matchesFilter(t, filter),
    )
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const first = due[0]?.due_date;
  if (!first) return { days: [], nextFrom: null };
  const last = addDays(first, days - 1);
  const byDay = new Map<string, Task[]>();
  for (const task of due) {
    if (task.due_date! > last) break;
    byDay.set(task.due_date!, [...(byDay.get(task.due_date!) ?? []), task]);
  }
  const later = due.find((t) => t.due_date! > last);
  return {
    days: [...byDay].map(([date, list]) => ({
      date,
      tasks: sortWithinDay(list),
    })),
    nextFrom: later ? later.due_date : null,
  };
}
