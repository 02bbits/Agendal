import { useRef, useState } from "react";
import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { DialogCheckbox } from "../../components/DialogCheckbox";
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
      actionsLayout="row"
      actions={
        <>
          <Button
            ref={cancelRef}
            variant="outline"
            fullWidth
            className="rounded-2xl! py-3.5 text-base font-semibold"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            fullWidth
            className="rounded-2xl! py-3.5 text-base font-semibold"
            onClick={() => onConfirm(taskCount ? action : "move")}
          >
            {t("common.delete")}
          </Button>
        </>
      }
    >
      {taskCount > 0 && (
        // On by default (the safe choice); off deletes the tasks with the project (#168)
        <DialogCheckbox
          label={t("project.move_tasks")}
          checked={action === "move"}
          onChange={(move) => setAction(move ? "move" : "delete")}
        />
      )}
    </Dialog>
  );
}
