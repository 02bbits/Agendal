import type { ReactElement } from "react";
import { t, type CopyKey } from "../../../copy";
import type { TaskPatch } from "../../../domain/api";
import { reminderPast } from "../../../domain/edit";
import {
  REMINDERS,
  REPEATS,
  type Reminder,
  type Repeat,
  type Task,
} from "../../../domain/types";
import { useTaskStore } from "../store";
import { ChoiceField } from "./ChoiceField";
import { DueDateField } from "./DueDateField";
import { ScheduleFields } from "./ScheduleFields";

export interface WhenSectionProps {
  task: Task;
  onSave: (patch: TaskPatch) => void;
}

export function WhenSection({ task, onSave }: WhenSectionProps): ReactElement {
  const store = useTaskStore();
  const zone =
    typeof store.clock.timeZone === "function"
      ? store.clock.timeZone()
      : store.clock.timeZone;
  const isReminderPast = reminderPast(task, store.clock.now(), zone);

  const reminderHelper = !task.due_date
    ? t("task.reminder_needs_date")
    : isReminderPast
      ? t("task.reminder_past")
      : undefined;

  return (
    <div>
      <h2 className="overline mt-6 mb-3 text-ink-secondary">
        {t("task.section_when")}
      </h2>
      <div className="flex flex-col gap-4">
        <DueDateField
          value={task.due_date}
          onSave={(due_date) => onSave({ due_date })}
        />
        <ScheduleFields
          startTime={task.start_time}
          endTime={task.end_time}
          onSave={onSave}
        />
        <ChoiceField<Reminder>
          id="task-reminder"
          label={t("task.reminder")}
          value={task.reminder}
          disabled={!task.due_date}
          helper={reminderHelper}
          options={REMINDERS.map((r) => ({
            value: r,
            label: t(`reminder.${r}` as CopyKey),
          }))}
          onChange={(reminder) => onSave({ reminder })}
        />
        <ChoiceField<Repeat>
          id="task-repeat"
          label={t("task.repeat")}
          value={task.repeat}
          options={REPEATS.map((r) => ({
            value: r,
            label: t(`repeat.${r}` as CopyKey),
          }))}
          onChange={(repeat) => onSave({ repeat })}
        />
      </div>
    </div>
  );
}
