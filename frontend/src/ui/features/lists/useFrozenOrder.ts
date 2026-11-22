import { useLayoutEffect, useMemo, useState } from "react";
import { freezeLayout, type FrozenLayout } from "../../domain/frozen";
import type { Task } from "../../domain/types";

/**
 * Freezes the list order around every task opened in the panel (`editingId`)
 * on this screen: each one is snapshotted the first time it opens, and the
 * snapshots lay out the list until the user leaves the screen (Spec 01 §5).
 * Closing the panel keeps them. Next keeps a page it navigates away from
 * hidden in React's <Activity> instead of unmounting it, so the snapshots are
 * dropped in a layout-effect cleanup, which runs when the page is hidden
 * (see Next's "Preserving UI state" guide). Coming back sorts the list again.
 */
export function useFrozenOrder(
  tasks: readonly Task[],
  editingId: string | null | undefined,
): FrozenLayout {
  const [snapshots, setSnapshots] = useState<ReadonlyMap<string, Task>>(
    () => new Map(),
  );

  // Adjust state while rendering, so the first frame after opening is already frozen
  if (editingId && !snapshots.has(editingId)) {
    const opened = tasks.find((t) => t.id === editingId);
    if (opened) setSnapshots(new Map(snapshots).set(editingId, opened));
  }

  useLayoutEffect(() => () => setSnapshots(new Map()), []);

  return useMemo(() => freezeLayout(tasks, snapshots), [tasks, snapshots]);
}
