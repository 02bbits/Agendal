import { useCallback } from "react";
import { t } from "../../copy";
import type { OrderRow, TaskApi } from "../../domain/api";
import type { OrderField } from "../../domain/order";
import type { Task } from "../../domain/types";
import type { ToastData } from "../../components/Toast";
import type { Clock } from "./types";

/** Writes manual-order keys (#178); returns an Undo that puts the previous keys back. */
export type ReorderFn = (
  keys: ReadonlyMap<string, string | null>,
  field: OrderField,
) => () => void;

/**
 * Manual order (#178): the keys show at once, then go out as one batch (`TaskApi.reorder`).
 * If the batch is refused the previous keys come back and the save-failed toast shows.
 */
export function useTaskOrder({
  api,
  clock,
  getTask,
  replaceRows,
  showToast,
}: {
  api: TaskApi;
  clock: Clock;
  getTask: (id: string) => Task | undefined;
  replaceRows: (rows: Task[]) => void;
  showToast: (toast: Omit<ToastData, "id">) => void;
}): ReorderFn {
  const reorder: ReorderFn = useCallback(
    (keys, field) => {
      const before = new Map<string, string | null>();
      const rows: OrderRow[] = [];
      const placed: Task[] = [];
      for (const [id, value] of keys) {
        const task = getTask(id);
        if (!task) continue;
        before.set(id, task[field] ?? null);
        rows.push({ id, field, value });
        placed.push({ ...task, [field]: value });
      }
      if (rows.length === 0) return () => {};

      const putBack = () =>
        replaceRows(
          [...before].flatMap(([id, value]) => {
            const task = getTask(id);
            return task ? [{ ...task, [field]: value }] : [];
          }),
        );
      replaceRows(placed);
      api.reorder?.(rows, clock.now().toISOString()).catch(() => {
        putBack();
        showToast({ message: t("error.save_failed") });
      });
      return () => reorder(before, field);
    },
    [api, clock, getTask, replaceRows, showToast],
  );
  return reorder;
}
