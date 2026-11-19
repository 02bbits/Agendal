import type { Task } from "@/ui";

/**
 * The project's progress as tasks change on this screen. The server's count covers completed
 * tasks not loaded yet, so it is kept and moved by what changed here: tasks done or undone,
 * new tasks done, completed tasks deleted.
 */
export function liveProgress({
  initial,
  initialOpenIds,
  initialCompletedIds,
  tasks,
  openCount,
  isSettling,
}: {
  initial: { done: number; total: number };
  initialOpenIds: Set<string>;
  initialCompletedIds: Set<string>;
  tasks: Task[];
  openCount: number;
  isSettling: (id: string) => boolean;
}): { done: number; total: number } {
  const isDone = (task: Task) => task.done && !isSettling(task.id);
  const count = (keep: (task: Task) => boolean) => tasks.filter(keep).length;

  const newlyDone = count((t) => initialOpenIds.has(t.id) && isDone(t));
  const newlyUndone = count((t) => initialCompletedIds.has(t.id) && !isDone(t));
  const createdDone = count(
    (t) =>
      !initialOpenIds.has(t.id) && !initialCompletedIds.has(t.id) && isDone(t),
  );
  const shown = new Set(tasks.map((t) => t.id));
  const deletedCompleted = [...initialCompletedIds].filter(
    (id) => !shown.has(id),
  ).length;

  const done = Math.max(
    0,
    initial.done + newlyDone + createdDone - newlyUndone - deletedCompleted,
  );
  return { done, total: done + openCount };
}
