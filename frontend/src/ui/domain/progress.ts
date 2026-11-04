import { inToday } from "./lists";
import type { Task } from "./types";

export interface Progress {
  done: number;
  total: number;
}

/**
 * Inbox progress (LV-1): total = open tasks due today or overdue, plus tasks
 * completed today that were due or started today or earlier; done = the completed part.
 */
export function inboxProgress(
  tasks: readonly Task[],
  today: string,
  completedToday: (task: Task) => boolean,
): Progress {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    const isOverdue = Boolean(task.due_date && task.due_date < today);
    const isInToday = inToday(task, today);

    if (!task.done) {
      if (isOverdue || isInToday) {
        total += 1;
      }
    } else if (completedToday(task)) {
      const dueOrStartOnOrBefore =
        Boolean(task.due_date && task.due_date <= today) ||
        Boolean(task.start_date && task.start_date <= today);
      if (dueOrStartOnOrBefore) {
        total += 1;
        done += 1;
      }
    }
  }
  return { done, total };
}

/**
 * The next open task for the "Next: … at 16:00" line (LV-1): only open tasks in today;
 * timed tasks first (start_date === today && start_time) by start, then the first of them.
 */
export function nextUp(open: readonly Task[], today: string): Task | null {
  const todayTasks = open.filter((t) => !t.done && inToday(t, today));
  const timed = todayTasks
    .filter((t) => t.start_date === today && t.start_time)
    .sort((a, b) => a.start_time!.localeCompare(b.start_time!));
  return timed[0] ?? todayTasks[0] ?? null;
}
