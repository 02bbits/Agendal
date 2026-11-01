import type { Task } from "./types";

export interface Progress {
  done: number;
  total: number;
}

/**
 * Inbox progress (LV-1): total = open tasks due today or overdue, plus tasks
 * completed today that were due today or earlier; done = the completed part.
 * Completing an overdue task counts toward today (LV-E3).
 */
export function inboxProgress(
  tasks: readonly Task[],
  today: string,
  completedToday: (task: Task) => boolean,
): Progress {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    if (!task.due_date || task.due_date > today) continue;
    if (!task.done) total += 1;
    else if (completedToday(task)) {
      total += 1;
      done += 1;
    }
  }
  return { done, total };
}

/**
 * The next open task for the "Next: … at 16:00" line (LV-1): only open tasks due today;
 * timed tasks first by start, then the first untimed one due today. Overdue tasks are never next.
 */
export function nextUp(open: readonly Task[], today: string): Task | null {
  const dueToday = open.filter((t) => !t.done && t.due_date === today);
  const timed = dueToday
    .filter((t) => t.start_time)
    .sort((a, b) => a.start_time!.localeCompare(b.start_time!));
  return timed[0] ?? dueToday[0] ?? null;
}
