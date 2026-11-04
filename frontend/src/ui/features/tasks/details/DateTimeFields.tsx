import { useState, type ReactElement } from "react";
import { DatePicker } from "../../../components/DatePicker";
import { CalendarIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { t } from "../../../copy";
import type { TaskPatch } from "../../../domain/api";
import { startAfterDue } from "../../../domain/edit";
import type { Task, TimeFormat, WeekStart } from "../../../domain/types";
import { SettingsRow } from "./SettingsRow";
import { buildTimeOptions } from "./timeOptions";

export interface DateTimeFieldsProps {
  task: Pick<Task, "start_date" | "start_time" | "due_date" | "due_time">;
  timeFormat?: TimeFormat;
  weekStart?: WeekStart;
  onSave: (patch: TaskPatch) => void;
  variant?: "panel" | "screen";
}

/**
 * Start date with its optional start time, then due date with its optional
 * due time (TK §2.2). A time needs its date, and start must be before due
 * (TK-3); a change that breaks the order shows the error and isn't saved.
 */
export function DateTimeFields({
  task,
  timeFormat = "24h",
  weekStart = "mon",
  onSave,
  variant = "panel",
}: DateTimeFieldsProps): ReactElement {
  const [error, setError] = useState<"start_date" | "start_time" | null>(null);

  const save = (patch: TaskPatch) => {
    const field = startAfterDue({ ...task, ...patch });
    setError(field);
    if (!field) onSave(patch);
  };

  const sameDay = task.start_date !== null && task.start_date === task.due_date;
  const errorId = "task-dates-error";
  const describedBy = error ? errorId : undefined;
  const errorText = error ? t("task.start_after_due") : undefined;

  return (
    <>
      <SettingsRow
        variant={variant}
        icon={<CalendarIcon size={18} />}
        label={t("task.start_date")}
        control={
          <div className="flex items-center gap-1.5">
            <DatePicker
              id="task-start-date"
              label={t("task.start_date")}
              value={task.start_date}
              clearable
              onChange={(val) =>
                save(
                  val
                    ? { start_date: val }
                    : { start_date: null, start_time: null },
                )
              }
              weekStart={weekStart}
              variant="row"
            />
            <Picker<string>
              id="task-start"
              label={t("task.start")}
              value={task.start_time ?? ""}
              options={buildTimeOptions(
                null,
                task.start_time ?? "",
                timeFormat,
              )}
              disabled={!task.start_date}
              onChange={(val) => save({ start_time: val || null })}
              variant="row"
              ariaDescribedBy={describedBy}
            />
          </div>
        }
      />
      <SettingsRow
        variant={variant}
        icon={<CalendarIcon size={18} />}
        label={t("task.due")}
        error={errorText}
        errorId={errorId}
        control={
          <div className="flex items-center gap-1.5">
            <DatePicker
              id="task-due"
              label={t("task.due")}
              value={task.due_date}
              clearable
              onChange={(val) =>
                save(
                  val ? { due_date: val } : { due_date: null, due_time: null },
                )
              }
              weekStart={weekStart}
              variant="row"
            />
            <Picker<string>
              id="task-due-time"
              label={t("task.due_time")}
              value={task.due_time ?? ""}
              options={buildTimeOptions(
                sameDay ? task.start_time : null,
                task.due_time ?? "",
                timeFormat,
              )}
              disabled={!task.due_date}
              onChange={(val) => save({ due_time: val || null })}
              variant="row"
              ariaDescribedBy={describedBy}
            />
          </div>
        }
      />
    </>
  );
}
