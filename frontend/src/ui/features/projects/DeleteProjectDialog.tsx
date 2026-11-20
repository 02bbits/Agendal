import { useRef, useState } from "react";
import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
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

/** "Delete “Portfolio”?", with a Move to No project checkbox (on, the safe default) when it has tasks (PJ-4); off, its tasks go too. */
export function DeleteProjectDialog({
  open,
  project,
  taskCount,
  onConfirm,
  onCancel,
}: DeleteProjectDialogProps) {
  const [action, setAction] = useState<ProjectTaskAction>("move");
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      initialFocusRef={cancelRef}
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
            {taskCount && action === "delete"
              ? tc("project.delete_with_tasks", taskCount)
              : t("common.delete")}
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
        // One checkbox, on by default (the safe choice); off deletes the tasks with the project (#168)
        <label className="my-2 flex cursor-pointer items-center gap-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
          <input
            type="checkbox"
            checked={action === "move"}
            onChange={(e) => setAction(e.target.checked ? "move" : "delete")}
            className="size-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
          />
          <span className="text-body text-ink">{t("project.move_tasks")}</span>
        </label>
      )}
    </Dialog>
  );
}
