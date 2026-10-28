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
