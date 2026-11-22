import type { Task } from "./types";

export interface FrozenLayout {
  /** Tasks to group and sort by: the edited one as it was when editing began. */
  layout: readonly Task[];
  /** The task to draw: always its latest data. */
  live: (task: Task) => Task;
}

const asIs = (task: Task) => task;

/**
 * While a task is open for editing its row keeps the section and place it had
 * when editing began, so changing a date or time doesn't make it jump away
 * (Spec 01 §5). The row still shows the new values. Once editing ends the
 * snapshot is dropped and the lists sort again.
 */
export function freezeLayout(
  tasks: readonly Task[],
  snapshot: Task | null,
): FrozenLayout {
  const current = snapshot && tasks.find((t) => t.id === snapshot.id);
  if (!snapshot || !current) return { layout: tasks, live: asIs };
  return {
    layout: tasks.map((t) => (t.id === snapshot.id ? snapshot : t)),
    live: (task) => (task.id === snapshot.id ? current : task),
  };
}
