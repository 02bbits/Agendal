import type { Task } from "./types";

export interface FrozenLayout {
  /** Tasks to group and sort by: each edited one as it was when first opened. */
  layout: readonly Task[];
  /** The task to draw: always its latest data. */
  live: (task: Task) => Task;
}

const asIs = (task: Task) => task;

/**
 * A task opened for editing keeps the section and place it had when it was
 * first opened, so changing a date or time doesn't make it jump away (Spec 01
 * §5). The row still shows the new values. Ticking it done is not frozen: done
 * and done_at come from the live task, so it still settles into Completed.
 * A snapshot of a task that no longer exists is ignored.
 */
export function freezeLayout(
  tasks: readonly Task[],
  snapshots: ReadonlyMap<string, Task>,
): FrozenLayout {
  if (snapshots.size === 0) return { layout: tasks, live: asIs };
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const layout = tasks.map((t) => {
    const snapshot = snapshots.get(t.id);
    return snapshot ? { ...snapshot, done: t.done, done_at: t.done_at } : t;
  });
  return {
    layout,
    live: (task) => byId.get(task.id) ?? task,
  };
}
