import type { ReactElement, ReactNode } from "react";
import { Button } from "../../../components/Button";
import { CheckIcon } from "../../../components/icons";
import { NavBar } from "../../../components/NavBar";
import { t, type CopyKey } from "../../../copy";
import type { TaskPatch } from "../../../domain/api";
import { PRIORITIES, type Priority, type Task } from "../../../domain/types";
import type { Navigate } from "../../shell/routes";
import { useTaskStore } from "../store";
import { ChoiceField } from "./ChoiceField";
import { DetailsFooter } from "./DetailsFooter";
import { NotesField } from "./NotesField";
import { TaskHeader } from "./TaskHeader";
import { WhenSection } from "./WhenSection";

export interface TaskDetailsProps {
  task: Task;
  onBack: () => void;
  navigate?: Navigate;
  sourceNote?: { name: string; href: string };
  deleteAction?: ReactNode;
}

export function TaskDetails({
  task,
  onBack,
  navigate,
  sourceNote,
  deleteAction,
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

      <WhenSection task={task} onSave={save} />

      <h2 className="overline mt-6 mb-3 text-ink-secondary">
        {t("task.section_details")}
      </h2>
      <div className="flex flex-col gap-4">
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
        <ChoiceField<string>
          id="task-project"
          label={t("task.project")}
          value={task.project_id ?? ""}
          options={[
            { value: "", label: t("project.none") },
            ...store.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          onChange={(project_id) =>
            save({ project_id: project_id ? project_id : null })
          }
        />
        <NotesField value={task.notes} onSave={(notes) => save({ notes })} />
      </div>

      {deleteAction && <div className="mt-6">{deleteAction}</div>}

      <div className="mt-6">
        <DetailsFooter
          createdAt={task.created_at}
          updatedAt={task.updated_at}
          todayDate={store.today}
          timeFormat={store.timeFormat}
        />
      </div>

      <div className="sticky bottom-0 mt-6 bg-paper pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => store.toggle(task)}
        >
          <CheckIcon size={18} />
          {t(task.done ? "task.mark_open" : "task.mark_done")}
        </Button>
      </div>
    </div>
  );
}
