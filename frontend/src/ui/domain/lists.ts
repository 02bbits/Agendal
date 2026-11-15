import { addDays } from "./dates";
import { entriesOf, matchesEntry } from "./entries";
import { inboxProgress, type Progress } from "./progress";
import type { Task } from "./types";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function priorityRank(priority: Task["priority"]): number {
  return priority ? PRIORITY_RANK[priority] : 3;
}

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
      priorityRank(a.priority) - priorityRank(b.priority) ||
      a.created_at.localeCompare(b.created_at)
    );
  });
}

/**
 * Priority order for groups in Today:
 * 0. Due today (deadline today)
 * 1. Starts today (starts today, due later or start-only)
 * 2. In progress (started in past, due in future)
 * 3. Planned {date} (start-only passed)
 */
export function todayGroupRank(task: Task, today: string): number {
  if (task.due_date === today) return 0;
  if (task.start_date === today) return 1;
  if (
    task.start_date &&
    task.start_date < today &&
    task.due_date &&
    task.due_date > today
  ) {
    return 2;
  }
  if (task.start_date && task.start_date < today && !task.due_date) {
    return 3;
  }
  return 4;
}

/**
 * Sorts tasks in Today: first by group (Due today -> Starts today -> In progress -> Planned),
 * then within each group timed first, then priority, then creation time.
 */
export function sortTodayTasks(tasks: readonly Task[], today: string): Task[] {
  return [...tasks].sort((a, b) => {
    const rankDiff = todayGroupRank(a, today) - todayGroupRank(b, today);
    if (rankDiff !== 0) return rankDiff;

    const aTime =
      a.start_date === today ? a.start_time : (a.due_time ?? a.start_time);
    const bTime =
      b.start_date === today ? b.start_time : (b.due_time ?? b.start_time);

    if (aTime && bTime) {
      return (
        aTime.localeCompare(bTime) || a.created_at.localeCompare(b.created_at)
      );
    }
    if (aTime) return -1;
    if (bTime) return 1;

    return (
      priorityRank(a.priority) - priorityRank(b.priority) ||
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

function dedupeTasks(tasks: readonly Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export function inToday(task: Task, today: string): boolean {
  if (task.due_date === today) return true;
  if (task.start_date === today) return true;
  if (task.start_date && task.start_date < today) {
    if (task.due_date && task.due_date > today) return true;
    if (!task.due_date) return true;
  }
  return false;
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
  const uniqueTasks = dedupeTasks(tasks);
  const settling = opts.isSettling ?? (() => false);
  const open = uniqueTasks.filter((t) => !t.done || settling(t.id));
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const todayTasks = open.filter((t) => inToday(t, today));
  const noDate = open.filter((t) => !t.due_date && !t.start_date);
  const completed = uniqueTasks.filter(
    (t) => t.done && !settling(t.id) && opts.completedToday(t),
  );
  return {
    overdue: [...overdue].sort(
      (a, b) =>
        a.due_date!.localeCompare(b.due_date!) ||
        a.created_at.localeCompare(b.created_at),
    ),
    today: sortTodayTasks(todayTasks, today),
    noDate: [...noDate].sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        b.created_at.localeCompare(a.created_at),
    ),
    completed: [...completed].sort((a, b) =>
      (b.done_at ?? "").localeCompare(a.done_at ?? ""),
    ),
    progress: inboxProgress(uniqueTasks, today, opts.completedToday),
    empty: uniqueTasks.length === 0,
  };
}

export type UpcomingFilter = "all" | "scheduled" | "due";

export interface UpcomingPage {
  days: Array<{ date: string; tasks: Task[] }>;
  /** Where the next page starts, or null when nothing more is due. */
  nextFrom: string | null;
}

/** Scheduled: has a start date, or repeats on a due date. Due only: has a due date. */
export function matchesFilter(task: Task, filter: UpcomingFilter): boolean {
  if (filter === "scheduled")
    return (
      !!task.start_date ||
      (!task.start_date && task.repeat !== "never" && !!task.due_date)
    );
  if (filter === "due") return !!task.due_date;
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
  const open = tasks.filter((t) => !t.done || isSettling(t.id));
  const byDay = new Map<string, Task[]>();

  for (const task of open) {
    const entries = entriesOf(task);
    for (const entry of entries) {
      if (matchesEntry(entry, filter) && entry.date >= from) {
        const list = byDay.get(entry.date) ?? [];
        list.push(entry.task);
        byDay.set(entry.date, list);
      }
    }
  }

  const sortedDates = [...byDay.keys()].sort();
  const first = sortedDates[0];
  if (!first) return { days: [], nextFrom: null };

  const last = addDays(first, days - 1);
  const visibleDates = sortedDates.filter((d) => d <= last);
  const laterDates = sortedDates.filter((d) => d > last);

  return {
    days: visibleDates.map((date) => ({
      date,
      tasks: sortWithinDay(byDay.get(date)!),
    })),
    nextFrom: laterDates[0] ?? null,
  };
}
