import { useCallback } from "react";
import { t } from "../../copy";
import type { TaskPatch } from "../../domain/api";
import { placeAt, type OrderField } from "../../domain/order";
import type { Task } from "../../domain/types";
import { useTaskStore } from "../tasks/store";
import type { ProjectDropData } from "./dnd/dropTargets";
import type { Receive } from "./dnd/TaskDndScope";

/**
 * A task dropped into this list from another one (Spec 02 §3): `patchFor` says what the move
 * changes (dates), and the task takes its place where it was dropped. The dates and its own
 * key go in one PATCH, so the server never sees the dates alone (which would drop the key).
 */
export function useReceiveDrop(
  field: OrderField,
  patchFor: (task: Task, from: string) => TaskPatch | null,
  onPlaced?: (id: string) => void,
): (shown: readonly Task[], drop: Receive) => void {
  const { tasks, update, reorder } = useTaskStore();
  return useCallback(
    (shown, { id, from, index }) => {
      const task = tasks.find((x) => x.id === id);
      const patch = task && patchFor(task, from);
      if (!task || !patch) return;
      const withIt = [...shown.slice(0, index), task, ...shown.slice(index)];
      const keys = placeAt(withIt, id, index, field);
      const own = keys.get(id) ?? null;
      keys.delete(id);
      onPlaced?.(id);
      update(task, { ...patch, [field]: own });
      if (keys.size) reorder(keys, field);
    },
    [field, onPlaced, patchFor, reorder, tasks, update],
  );
}

/** A task dropped on a project in the sidebar (Spec 02 §3): it moves there, with Undo. */
export function useMoveToProject(): (
  id: string,
  project: ProjectDropData,
) => void {
  const { tasks, update, showToast } = useTaskStore();
  return useCallback(
    (id, { projectId, name }) => {
      const task = tasks.find((x) => x.id === id);
      if (!task || task.project_id === projectId) return;
      const before: TaskPatch = {
        project_id: task.project_id,
        project_order: task.project_order ?? null,
      };
      update(task, { project_id: projectId });
      showToast({
        message: t("task.moved_to", { project: name }),
        actionLabel: t("common.undo"),
        onAction: () => update(id, before),
      });
    },
    [showToast, tasks, update],
  );
}
