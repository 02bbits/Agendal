import type { ReactElement } from "react";
import { DatePicker } from "../../../components/DatePicker";
import { CalendarIcon, ClockIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { t, type CopyKey } from "../../../copy";
import type { TimeFormat, WeekStart } from "../../../domain/types";
import { SettingsRow } from "../details/SettingsRow";
import { buildTimeOptions } from "../details/timeOptions";

const ERROR_ID = "new-task-dates-error";

export interface NewTaskStartTimeProps {
  startDate: string | null;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  error: CopyKey | null;
  timeFormat?: TimeFormat;
}

/** The start time, under the start date chips; only with a start date (TK §2.2, #154). */
export function NewTaskStartTime({
  startDate,
  startTime,
  onStartTimeChange,
  error,
  timeFormat = "24h",
}: NewTaskStartTimeProps): ReactElement {
  return (
    <SettingsRow
      icon={<ClockIcon size={18} />}
      label={t("task.start_time")}
      error={error ? t(error) : undefined}
      errorId={ERROR_ID}
      control={
        <Picker<string>
          id="new-task-start"
          variant="row"
          label={t("task.start_time")}
          value={startTime}
          options={buildTimeOptions(null, startTime, timeFormat)}
          disabled={!startDate}
          onChange={onStartTimeChange}
          ariaDescribedBy={error ? ERROR_ID : undefined}
        />
      }
    />
  );
}

export interface NewTaskDueProps {
  dueDate: string;
  onDueDateChange: (value: string) => void;
  dueTime: string;
  onDueTimeChange: (value: string) => void;
  startDate: string | null;
  startTime: string;
  error: CopyKey | null;
  timeFormat?: TimeFormat;
  weekStart?: WeekStart;
}

/** The optional due date (#154): empty by default, with its time once there is a date. */
export function NewTaskDue({
  dueDate,
  onDueDateChange,
  dueTime,
  onDueTimeChange,
  startDate,
  startTime,
  error,
  timeFormat = "24h",
  weekStart = "mon",
}: NewTaskDueProps): ReactElement {
  const sameDay = startDate !== null && startDate === dueDate;
  return (
    <SettingsRow
      icon={<CalendarIcon size={18} />}
      label={t("task.due")}
      control={
        <div className="flex items-center gap-1.5">
          <DatePicker
            id="new-task-due-date"
            variant="row"
            label={t("task.due")}
            value={dueDate || null}
            clearable
            onChange={(value) => onDueDateChange(value ?? "")}
            weekStart={weekStart}
          />
          <Picker<string>
            id="new-task-due-time"
            variant="row"
            label={t("task.due_time")}
            value={dueTime}
            options={buildTimeOptions(
              sameDay ? startTime || null : null,
              dueTime,
              timeFormat,
            )}
            disabled={!dueDate}
            onChange={onDueTimeChange}
            ariaDescribedBy={error ? ERROR_ID : undefined}
          />
        </div>
      }
    />
  );
}
