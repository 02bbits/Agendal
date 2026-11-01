import type { ReactElement, ReactNode } from "react";
import { Button } from "../../../components/Button";
import { NavBar } from "../../../components/NavBar";
import { t, type CopyKey } from "../../../copy";
import type { TaskPatch } from "../../../domain/api";
import { PRIORITIES, type Priority, type Task } from "../../../domain/types";
import type { Navigate } from "../../shell/routes";
import { useTaskStore } from "../store";
import { ChoiceField } from "./ChoiceField";
import { DetailsFooter } from "./DetailsFooter";
import { NotesField } from "./NotesField";
import { ProjectField } from "./ProjectField";
import { TaskHeader } from "./TaskHeader";
import { WhenSection } from "./WhenSection";

export interface TaskDetailsProps {
  task: Task;
  onBack: () => void;
  navigate?: Navigate;
  sourceNote?: { name: string; href: string };
  deleteAction?: ReactNode;
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  showSchedule?: boolean;
}

export function TaskDetails({
  task,
  onBack,
  navigate,
  sourceNote,
  deleteAction,
  projectsStatus = "ready",
  onRetryProjects,
  showSchedule = true,
}: TaskDetailsProps): ReactElement {
  const store = useTaskStore();
  function save(patch: TaskPatch) {
    store.update(task, patch);
  }

  return (
    <div className="pb-8">
      <NavBar backLabel={t("common.back")} onBack={onBack} />

      <TaskHeader
        task={task}
        onSaveTitle={(title) => save({ title })}
        sourceNote={sourceNote}
        navigate={navigate}
      />

      <WhenSection task={task} onSave={save} showSchedule={showSchedule} />

      <h2 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
        {t("task.section_details")}
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-separator/40 bg-surface p-4 shadow-xs">
        <ChoiceField<Priority>
          id="task-priority"
          label={t("task.priority")}
          value={task.priority ?? "low"}
          options={PRIORITIES.map((p) => ({
            value: p,
            label: t(`priority.${p}` as CopyKey),
          }))}
          onChange={(priority) => save({ priority })}
        />
        <ProjectField
          projectId={task.project_id}
          projects={store.projects}
          projectsStatus={projectsStatus}
          onRetryProjects={onRetryProjects}
          onChange={(project_id) => save({ project_id })}
        />
        <NotesField value={task.notes} onSave={(notes) => save({ notes })} />
      </div>

      {deleteAction && <div className="mt-6">{deleteAction}</div>}

      <div className="mt-6">
        <DetailsFooter
          createdAt={task.created_at}
          updatedAt={task.updated_at}
          todayDate={store.today}
          timeZone={store.clock.timeZone}
          timeFormat={store.timeFormat}
        />
      </div>

      <div className="sticky bottom-0 mt-8 flex items-center justify-end gap-3 border-t border-separator bg-paper pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button variant="secondary" onClick={onBack}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={onBack}>
          {t("common.save_changes")}
        </Button>
      </div>
    </div>
  );
}
