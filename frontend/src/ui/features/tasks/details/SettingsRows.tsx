import type { ReactElement } from "react";
import { cx } from "../../../components/cx";
import { BellIcon, RepeatIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { t, type CopyKey } from "../../../copy";
import type { TaskPatch } from "../../../domain/api";
import { reminderPast } from "../../../domain/edit";
import { describeRepeat } from "../../../domain/repeat";
import {
  REMINDERS,
  REPEATS,
  type Project,
  type Reminder,
  type Repeat,
  type Task,
  type TimeFormat,
  type WeekStart,
} from "../../../domain/types";
import type { Clock } from "../types";
import { DateTimeFields } from "./DateTimeFields";
import { ProjectField } from "./ProjectField";
import { SettingsRow } from "./SettingsRow";

export interface SettingsRowsProps {
  task: Task;
  projects: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  todayDate: string;
  clock: Clock;
  timeFormat?: TimeFormat;
  weekStart?: WeekStart;
  showSchedule?: boolean;
  onSave: (patch: TaskPatch) => void;
  variant?: "panel" | "screen";
}

export function SettingsRows({
  task,
  projects,
  projectsStatus = "ready",
  onRetryProjects,
  clock,
  timeFormat,
  weekStart,
  onSave,
  variant = "panel",
}: SettingsRowsProps): ReactElement {
  const isReminderPast = reminderPast(task, clock.now(), clock.timeZone);

  const hasDate = Boolean(task.start_date || task.due_date);
  const reminderHelper = !hasDate
    ? t("task.reminder_needs_date")
    : isReminderPast
      ? t("task.reminder_past")
      : undefined;

  const repeatHelper = describeRepeat(task);

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
      <DateTimeFields
        task={task}
        timeFormat={timeFormat}
        weekStart={weekStart}
        onSave={onSave}
        variant={variant}
      />
      <SettingsRow
        variant={variant}
        icon={<BellIcon size={18} />}
        tileBg="bg-project-orange/15 text-project-orange"
        label={t("task.reminder")}
        helper={reminderHelper}
        helperId="task-reminder-helper"
        control={
          <Picker<Reminder>
            id="task-reminder"
            label={t("task.reminder")}
            value={task.reminder}
            disabled={!hasDate}
            options={REMINDERS.map((r) => ({
              value: r,
              label: t(`reminder.${r}` as CopyKey),
            }))}
            onChange={(reminder) => onSave({ reminder })}
            variant={variant}
          />
        }
      />
      <SettingsRow
        variant={variant}
        icon={<RepeatIcon size={18} />}
        tileBg="bg-fill text-ink-secondary"
        label={t("task.repeat")}
        helper={repeatHelper}
        helperId="task-repeat-helper"
        control={
          <Picker<Repeat>
            id="task-repeat"
            label={t("task.repeat")}
            value={task.repeat}
            options={REPEATS.map((r) => ({
              value: r,
              label: t(`repeat.${r}` as CopyKey),
            }))}
            onChange={(repeat) => onSave({ repeat })}
            variant={variant}
            ariaDescribedBy={repeatHelper ? "task-repeat-helper" : undefined}
          />
        }
      />
    </div>
  );
}
