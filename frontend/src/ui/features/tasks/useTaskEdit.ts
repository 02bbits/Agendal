import { useCallback, useEffect, useRef } from "react";
import { t } from "../../copy";
import type { TaskApi, TaskPatch, TaskUpdateErrors } from "../../domain/api";
import { normalizePatch, patchErrors } from "../../domain/edit";
import type { Task } from "../../domain/types";
import type { Clock, TaskUpdateFn, ToastDraft } from "./types";
import type { UseTaskSyncReturn } from "./useTaskSync";

export interface UseTaskEditOptions {
  getTask: (id: string) => Task | undefined;
  change: UseTaskSyncReturn["change"];
  api: TaskApi;
  clock: Clock;
  todayDate: string;
  showToast: (draft: ToastDraft) => void;
  handleSaveError: (error: unknown, retry: () => void) => void;
}

export function useTaskEdit({
  getTask,
  change,
  api,
  clock,
  todayDate,
  showToast,
  handleSaveError,
}: UseTaskEditOptions) {
  const updateRef = useRef<TaskUpdateFn>(() => ({}));

  const update: TaskUpdateFn = useCallback(
    (taskOrId: Task | string, raw: TaskPatch): TaskUpdateErrors => {
      const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
      const row =
        getTask(id) ?? (typeof taskOrId === "object" ? taskOrId : undefined);
      if (!row) return {};

      const patch = normalizePatch(row, raw, todayDate);
      const errors = patchErrors(row, patch);
      if (Object.keys(errors).length > 0 || Object.keys(patch).length === 0) {
        return errors;
      }

      const at = clock.now().toISOString();

      if ("due_date" in raw && !raw.due_date && Boolean(row.due_date)) {
        const restore: TaskPatch = {
          due_date: row.due_date,
          start_time: row.start_time,
          end_time: row.end_time,
          reminder: row.reminder,
        };
        showToast({
          message: t("task.due_cleared"),
          actionLabel: t("common.undo"),
          onAction: () => {
            updateRef.current(id, restore);
          },
        });
      }

      change(
        id,
        patch,
        () => api.patch(id, patch, at),
        (error) => {
          handleSaveError(error, () => {
            updateRef.current(id, raw);
          });
        },
      );

      return errors;
    },
    [api, change, clock, getTask, handleSaveError, showToast, todayDate],
  );

  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  return { update };
}
