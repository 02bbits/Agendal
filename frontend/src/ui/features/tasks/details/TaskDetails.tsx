import type { ReactElement, ReactNode } from "react";
import { Button } from "../../../components/Button";
import { TrashIcon } from "../../../components/icons";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import type { TaskPatch } from "../../../domain/api";
import type { Project, Task } from "../../../domain/types";
import type { Navigate } from "../../shell/routes";
import { useTaskStore } from "../store";
import { DetailsFooter } from "./DetailsFooter";
import { NotesField } from "./NotesField";
import { PriorityField } from "./PriorityField";
import { SettingsRows } from "./SettingsRows";
import { TaskHeader } from "./TaskHeader";

export interface TaskDetailsProps {
  task: Task;
  onBack: () => void;
  onClose?: () => void;
  navigate?: Navigate;
  sourceNote?: { name: string; href: string };
  deleteAction?: ReactNode;
  onDelete?: () => void;
  projects?: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  showSchedule?: boolean;
  variant?: "panel" | "screen";
  backLabel?: string;
  autoFocusTitle?: boolean;
}

export function TaskDetails({
  task,
  onBack,
  onClose,
  sourceNote,
  deleteAction,
  onDelete,
  projects,
  projectsStatus = "ready",
  onRetryProjects,
  showSchedule = true,
  variant = "panel",
  backLabel,
  autoFocusTitle,
}: TaskDetailsProps): ReactElement {
  const store = useTaskStore();
  const currentProjects = projects ?? store.projects;
  const project = currentProjects.find((p) => p.id === task.project_id) ?? null;

  function save(patch: TaskPatch) {
    store.update(task, patch);
  }

  const isScreen = variant === "screen";

  return (
    <div
      className={cx(
        "flex flex-col text-ink",
        isScreen ? "min-h-screen bg-paper pb-8" : "h-full bg-surface",
      )}
    >
      <TaskHeader
        task={task}
        onSaveTitle={(title) => save({ title })}
        onBack={onBack}
        onClose={onClose}
        backLabel={backLabel}
        variant={variant}
        project={project}
        autoFocusTitle={autoFocusTitle}
      />

      <div
        className={cx(
          "flex flex-1 flex-col gap-5",
          isScreen ? "px-4 pt-4" : "overflow-y-auto px-4 py-4",
        )}
      >
        <NotesField
          value={task.notes}
          onSave={(notes) => save({ notes })}
          variant={variant}
        />

        <PriorityField
          value={task.priority ?? "low"}
          onChange={(priority) => save({ priority })}
          variant={variant}
        />

        <SettingsRows
          task={task}
          projects={currentProjects}
          projectsStatus={projectsStatus}
          onRetryProjects={onRetryProjects}
          todayDate={store.today}
          clock={store.clock}
          showSchedule={showSchedule}
          onSave={save}
          variant={variant}
        />

        <DetailsFooter
          createdAt={task.created_at}
          updatedAt={task.updated_at}
          todayDate={store.today}
          timeZone={store.clock.timeZone}
          timeFormat={store.timeFormat}
          createdBy={task.created_by}
          sourceNote={sourceNote}
        />

        <div className={cx(isScreen ? "mt-auto pt-4" : "mt-auto pt-4")}>
          {deleteAction ? (
            deleteAction
          ) : (
            <Button
              variant="destructive"
              fullWidth
              disabled={!onDelete}
              aria-disabled={!onDelete ? "true" : undefined}
              onClick={onDelete}
              className="gap-2"
            >
              <TrashIcon size={16} />
              <span>{isScreen ? t("task.delete") : t("common.delete")}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
