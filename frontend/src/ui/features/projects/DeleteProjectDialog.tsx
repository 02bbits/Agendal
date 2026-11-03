import { useId, useRef, useState } from "react";
import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { cx } from "../../components/cx";
import type {
  DeleteProjectHandler,
  ProjectTaskAction,
} from "../../domain/projects";
import type { Project } from "../../domain/types";

export type { DeleteProjectHandler, ProjectTaskAction };

export interface DeleteProjectDialogProps {
  open: boolean;
  project: Project;
  /** Non-deleted tasks in the project, open and completed. */
  taskCount: number;
  onConfirm: (tasks: ProjectTaskAction) => void;
  onCancel: () => void;
}

/** "Delete “Portfolio”?", with Move to No project (default, safe) or Delete them too when it has tasks (PJ-4). */
export function DeleteProjectDialog({
  open,
  project,
  taskCount,
  onConfirm,
  onCancel,
}: DeleteProjectDialogProps) {
  const [action, setAction] = useState<ProjectTaskAction>("move");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const name = useId();

  return (
    <Dialog
      open={open}
      title={t("project.delete_title", { name: project.name })}
      description={taskCount ? tc("project.delete_body", taskCount) : undefined}
      onClose={onCancel}
      actions={
        <>
          <Button
            variant="destructive"
            fullWidth
            className="rounded-2xl! py-3.5 text-base font-semibold"
            onClick={() => onConfirm(taskCount ? action : "move")}
          >
            {t("common.delete")}
          </Button>
          <Button
            ref={cancelRef}
            variant="outline"
            fullWidth
            className="rounded-2xl! py-3.5 text-base font-semibold"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      {taskCount > 0 && (
        <fieldset className="my-2 flex flex-col border-0 p-0">
          <legend className="sr-only">
            {tc("project.delete_body", taskCount)}
          </legend>

          <label
            className={cx(
              "group/choice relative flex cursor-pointer items-center justify-between border-b border-separator/80 py-3.5 transition-colors",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={action === "move"}
              onChange={() => setAction("move")}
              className="sr-only"
            />
            <span
              className={cx(
                "text-body transition-colors",
                action === "move" ? "font-semibold text-ink" : "text-ink/80",
              )}
            >
              {t("project.move_tasks")}
            </span>
          </label>

          <label
            className={cx(
              "group/choice relative flex cursor-pointer items-center justify-between border-b border-separator/80 py-3.5 transition-colors",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-error",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={action === "delete"}
              onChange={() => setAction("delete")}
              className="sr-only"
            />
            <span
              className={cx(
                "text-body text-error transition-colors",
                action === "delete"
                  ? "font-semibold"
                  : "font-normal opacity-90",
              )}
            >
              {t("project.delete_tasks")}
            </span>
          </label>
        </fieldset>
      )}
    </Dialog>
  );
}
