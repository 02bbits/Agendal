import type { ReactElement } from "react";
import { DatePicker } from "../../../components/DatePicker";
import { CalendarIcon, ClockIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { t, type CopyKey } from "../../../copy";
import type { TimeFormat, WeekStart } from "../../../domain/types";
import { SettingsRow } from "../details/SettingsRow";
import { buildTimeOptions } from "../details/timeOptions";

export interface NewTaskDatesProps {
  dueDate: string | null;
  dueTime: string;
  onDueTimeChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  error: CopyKey | null;
  timeFormat?: TimeFormat;
  weekStart?: WeekStart;
}

/** Due time, then start date with its start time, under the due chips (TK §2.2). */
export function NewTaskDates({
  dueDate,
  dueTime,
  onDueTimeChange,
  startDate,
  onStartDateChange,
  startTime,
  onStartTimeChange,
  error,
  timeFormat = "24h",
  weekStart = "mon",
}: NewTaskDatesProps): ReactElement {
  const errorId = "new-task-dates-error";
  const describedBy = error ? errorId : undefined;
  const sameDay = startDate !== "" && startDate === dueDate;

  return (
    <div className="flex flex-col">
      <SettingsRow
        icon={<ClockIcon size={18} />}
        label={t("task.due_time")}
        control={
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
            ariaDescribedBy={describedBy}
          />
        }
      />
      <SettingsRow
        icon={<CalendarIcon size={18} />}
        label={t("task.start_date")}
        error={error ? t(error) : undefined}
        errorId={errorId}
        control={
          <div className="flex items-center gap-1.5">
            <DatePicker
              id="new-task-start-date"
              variant="row"
              label={t("task.start_date")}
              value={startDate || null}
              clearable
              onChange={(val) => onStartDateChange(val ?? "")}
              weekStart={weekStart}
            />
            <Picker<string>
              id="new-task-start"
              variant="row"
              label={t("task.start")}
              value={startTime}
              options={buildTimeOptions(null, startTime, timeFormat)}
              disabled={!startDate}
              onChange={onStartTimeChange}
              ariaDescribedBy={describedBy}
            />
          </div>
        }
      />
    </div>
  );
}
