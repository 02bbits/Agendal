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
 * §5). The row still shows the new values. Two changes are not frozen, so
 * they come from the live task: ticking it done (done, done_at), which still
 * settles into Completed, and moving it to another project (project_id), which
 * takes it off that project's list at once. A drag is never held either: the
 * order keys (project_order, day_order) are live too (#178).
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
    if (!snapshot) return t;
    const { done, done_at, project_id, project_order, day_order } = t;
    return { ...snapshot, done, done_at, project_id, project_order, day_order };
  });
  return {
    layout,
    live: (task) => byId.get(task.id) ?? task,
  };
}
