import type { ReactElement } from "react";
import type { TaskPatch } from "../../../domain/api";
import type { Task } from "../../../domain/types";
import { useTaskStore } from "../store";
import { SettingsRows } from "./SettingsRows";

export interface WhenSectionProps {
  task: Task;
  onSave: (patch: TaskPatch) => void;
  showSchedule?: boolean;
  variant?: "panel" | "screen";
}

export function WhenSection({
  task,
  onSave,
  showSchedule = true,
  variant = "panel",
}: WhenSectionProps): ReactElement {
  const store = useTaskStore();
  return (
    <SettingsRows
      task={task}
      projects={store.projects}
      todayDate={store.today}
      clock={store.clock}
      showSchedule={showSchedule}
      onSave={onSave}
      variant={variant}
    />
  );
}
