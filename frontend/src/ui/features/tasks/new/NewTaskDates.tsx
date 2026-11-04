import type { ReactElement } from "react";
import { DatePicker } from "../../../components/DatePicker";
import { CalendarIcon, ClockIcon, RepeatIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { t, type CopyKey } from "../../../copy";
import {
  REPEATS,
  type Repeat,
  type TimeFormat,
  type WeekStart,
} from "../../../domain/types";
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
  repeat: Repeat;
  onRepeatChange: (value: Repeat) => void;
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
  repeat,
  onRepeatChange,
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
              label={t("task.start_date")}
              value={startDate || null}
              clearable
              onChange={(val) => onStartDateChange(val ?? "")}
              weekStart={weekStart}
            />
            <Picker<string>
              id="new-task-start"
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
      <SettingsRow
        icon={<RepeatIcon size={18} />}
        label={t("task.repeat")}
        control={
          <Picker<Repeat>
            id="new-task-repeat"
            label={t("task.repeat")}
            value={repeat}
            options={REPEATS.map((r) => ({
              value: r,
              label: t(`repeat.${r}` as CopyKey),
            }))}
            onChange={onRepeatChange}
          />
        }
      />
    </div>
  );
}
