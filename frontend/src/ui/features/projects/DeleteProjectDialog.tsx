import { useId, useRef, useState } from "react";
import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import type { ProjectTaskAction } from "../../domain/api";
import type { Project } from "../../domain/types";

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
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button
            variant="destructive"
            onClick={() => onConfirm(taskCount ? action : "move")}
          >
            {t("common.delete")}
          </Button>
          <Button ref={cancelRef} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      {taskCount > 0 && (
        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">
            {tc("project.delete_body", taskCount)}
          </legend>
          <label className="group/choice relative flex min-h-11 cursor-pointer items-center gap-3 border-b border-separator has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary [&>input]:absolute [&>input]:inset-0 [&>input]:m-0 [&>input]:cursor-pointer [&>input]:opacity-0">
            <input
              type="radio"
              name={name}
              checked={action === "move"}
              onChange={() => setAction("move")}
            />
            <span className="flex-1 group-has-checked/choice:font-medium group-has-checked/choice:text-primary">
              {t("project.move_tasks")}
            </span>
          </label>
          <label className="group/choice relative flex min-h-11 cursor-pointer items-center gap-3 border-b border-separator has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary [&>input]:absolute [&>input]:inset-0 [&>input]:m-0 [&>input]:cursor-pointer [&>input]:opacity-0 [&>span]:text-error!">
            <input
              type="radio"
              name={name}
              checked={action === "delete"}
              onChange={() => setAction("delete")}
            />
            <span className="flex-1 group-has-checked/choice:font-medium group-has-checked/choice:text-primary">
              {t("project.delete_tasks")}
            </span>
          </label>
        </fieldset>
      )}
    </Dialog>
  );
}
