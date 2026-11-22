import { useMemo, useState } from "react";
import { freezeLayout, type FrozenLayout } from "../../domain/frozen";
import type { Task } from "../../domain/types";

/**
 * Freezes the list order around the task open in the panel (`editingId`):
 * the task is snapshotted when it opens and the snapshot is used for layout
 * until the panel closes or switches task (Spec 01 §5).
 */
export function useFrozenOrder(
  tasks: readonly Task[],
  editingId: string | null | undefined,
): FrozenLayout {
  const id = editingId ?? null;
  const [snapshot, setSnapshot] = useState<Task | null>(null);

  // Adjust state while rendering, so the first frame after opening is already frozen
  if ((snapshot?.id ?? null) !== id) {
    const opened = id ? (tasks.find((t) => t.id === id) ?? null) : null;
    if (opened !== snapshot) setSnapshot(opened);
  }

  const frozen = snapshot?.id === id ? snapshot : null;
  return useMemo(() => freezeLayout(tasks, frozen), [tasks, frozen]);
}
