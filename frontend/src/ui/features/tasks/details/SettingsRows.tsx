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
  const reminderHelper = isReminderPast ? t("task.reminder_past") : undefined;

  const repeatDescription = describeRepeat(task);
  const repeatLabel = repeatDescription
    ? repeatDescription.charAt(0).toLocaleUpperCase() +
      repeatDescription.slice(1)
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
            variant="row"
          />
        }
      />
      <SettingsRow
        variant={variant}
        icon={<RepeatIcon size={18} />}
        label={t("task.repeat")}
        control={
          <Picker<Repeat>
            id="task-repeat"
            label={t("task.repeat")}
            value={task.repeat}
            className="max-w-[180px] [&>div]:max-w-full [&>div>button]:max-w-full [&>div>button>span]:truncate"
            options={REPEATS.map((r) => ({
              value: r,
              label:
                r === task.repeat && repeatLabel
                  ? repeatLabel
                  : t(`repeat.${r}` as CopyKey),
            }))}
            onChange={(repeat) => onSave({ repeat })}
            variant="row"
          />
        }
      />
    </div>
  );
}
