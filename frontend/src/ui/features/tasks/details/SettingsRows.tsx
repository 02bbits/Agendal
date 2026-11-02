import type { ReactElement } from "react";
import { cx } from "../../../components/cx";
import { BellIcon, RepeatIcon } from "../../../components/icons";
import { t, type CopyKey } from "../../../copy";
import type { TaskPatch } from "../../../domain/api";
import { reminderPast } from "../../../domain/edit";
import {
  REMINDERS,
  REPEATS,
  type Project,
  type Reminder,
  type Repeat,
  type Task,
} from "../../../domain/types";
import type { Clock } from "../types";
import { ChoiceField } from "./ChoiceField";
import { DueDateField } from "./DueDateField";
import { ProjectField } from "./ProjectField";
import { ScheduleFields } from "./ScheduleFields";

export interface SettingsRowsProps {
  task: Task;
  projects: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  todayDate: string;
  clock: Clock;
  showSchedule?: boolean;
  onSave: (patch: TaskPatch) => void;
  variant?: "panel" | "screen";
}

export function SettingsRows({
  task,
  projects,
  projectsStatus = "ready",
  onRetryProjects,
  todayDate,
  clock,
  showSchedule = true,
  onSave,
  variant = "panel",
}: SettingsRowsProps): ReactElement {
  const isReminderPast = reminderPast(task, clock.now(), clock.timeZone);

  const reminderHelper = !task.due_date
    ? t("task.reminder_needs_date")
    : isReminderPast
      ? t("task.reminder_past")
      : undefined;

  const isScreen = variant === "screen";

  return (
    <div
      className={cx(
        isScreen
          ? "divide-y divide-separator overflow-hidden rounded-box border border-separator bg-surface shadow-xs"
          : "flex flex-col",
      )}
    >
      <ProjectField
        projectId={task.project_id}
        projects={projects}
        projectsStatus={projectsStatus}
        onRetryProjects={onRetryProjects}
        onChange={(project_id) => onSave({ project_id })}
        variant={variant}
      />
      <DueDateField
        value={task.due_date}
        todayDate={todayDate}
        onSave={(due_date) => onSave({ due_date })}
        variant={variant}
      />
      {showSchedule && (
        <ScheduleFields
          startTime={task.start_time}
          endTime={task.end_time}
          onSave={onSave}
          variant={variant}
        />
      )}
      <ChoiceField<Reminder>
        id="task-reminder"
        label={t("task.reminder")}
        value={task.reminder}
        disabled={!task.due_date}
        helper={reminderHelper}
        icon={<BellIcon size={18} />}
        tileBg="bg-project-orange/15 text-project-orange"
        options={REMINDERS.map((r) => ({
          value: r,
          label: t(`reminder.${r}` as CopyKey),
        }))}
        onChange={(reminder) => onSave({ reminder })}
        variant={variant}
      />
      <ChoiceField<Repeat>
        id="task-repeat"
        label={t("task.repeat")}
        value={task.repeat}
        icon={<RepeatIcon size={18} />}
        tileBg="bg-fill text-ink-secondary"
        options={REPEATS.map((r) => ({
          value: r,
          label: t(`repeat.${r}` as CopyKey),
        }))}
        onChange={(repeat) => onSave({ repeat })}
        variant={variant}
      />
    </div>
  );
}
