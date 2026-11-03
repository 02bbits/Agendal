import { useState, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { ClockIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { t, type CopyKey } from "../../../copy";
import type { TimeFormat } from "../../../domain/types";
import { buildTimeOptions } from "./timeOptions";

export interface ScheduleFieldsProps {
  startTime: string | null;
  dueTime: string | null;
  sameDay: boolean;
  timeFormat?: TimeFormat;
  onSave: (patch: {
    start_time: string | null;
    due_time: string | null;
  }) => void;
  variant?: "panel" | "screen";
}

/** On the same day the start time must be before the due time (TK-3). */
function timeError(
  sameDay: boolean,
  start: string | null,
  due: string | null,
): CopyKey | null {
  return sameDay && start && due && start >= due
    ? "task.start_after_due"
    : null;
}

export function ScheduleFields({
  startTime,
  dueTime,
  sameDay,
  timeFormat = "24h",
  onSave,
  variant = "panel",
}: ScheduleFieldsProps): ReactElement {
  const [start, setStart] = useState(startTime ?? "");
  const [due, setDue] = useState(dueTime ?? "");
  const [error, setError] = useState<CopyKey | null>(() =>
    timeError(sameDay, startTime, dueTime),
  );
  const [prevStart, setPrevStart] = useState(startTime);
  const [prevDue, setPrevDue] = useState(dueTime);
  const [prevSameDay, setPrevSameDay] = useState(sameDay);

  if (
    startTime !== prevStart ||
    dueTime !== prevDue ||
    sameDay !== prevSameDay
  ) {
    setPrevStart(startTime);
    setPrevDue(dueTime);
    setPrevSameDay(sameDay);
    setStart(startTime ?? "");
    setDue(dueTime ?? "");
    setError(timeError(sameDay, startTime, dueTime));
  }

  const handleStartChange = (nextStart: string) => {
    setStart(nextStart);
    if (!nextStart) {
      setError(null);
      onSave({ start_time: null, due_time: due || null });
      return;
    }
    const err = timeError(sameDay, nextStart, due || null);
    setError(err);
    if (!err) {
      onSave({ start_time: nextStart, due_time: due || null });
    }
  };

  const handleDueChange = (nextDue: string) => {
    setDue(nextDue);
    if (!nextDue) {
      setError(null);
      onSave({ start_time: start || null, due_time: null });
      return;
    }
    const err = timeError(sameDay, start || null, nextDue);
    setError(err);
    if (!err) {
      onSave({ start_time: start || null, due_time: nextDue });
    }
  };

  const isScreen = variant === "screen";
  const startOptions = buildTimeOptions(null, start, timeFormat);
  const dueOptions = buildTimeOptions(
    sameDay ? start || null : null,
    due,
    timeFormat,
  );

  return (
    <div
      className={cx(
        "flex flex-col py-2.5",
        isScreen ? "px-4" : "border-b border-separator last:border-b-0",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-body text-ink">
          {isScreen ? (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-tile bg-project-blue/15 text-project-blue">
              <ClockIcon size={18} />
            </div>
          ) : (
            <span className="flex items-center justify-center text-ink-tertiary">
              <ClockIcon size={18} />
            </span>
          )}
          <span className="font-normal">{t("task.schedule")}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Picker<string>
            id="task-start"
            label={t("task.start")}
            value={start}
            options={startOptions}
            onChange={handleStartChange}
            variant={variant}
          />
          <span className="text-ink-secondary" aria-hidden="true">
            {"–"}
          </span>
          <Picker<string>
            id="task-due-time"
            label={t("task.due_time")}
            value={due}
            options={dueOptions}
            onChange={handleDueChange}
            variant={variant}
            ariaDescribedBy={error ? "task-due-time-error" : undefined}
          />
        </div>
      </div>
      {error && (
        <p
          id="task-due-time-error"
          role="alert"
          className="mt-1 text-footnote text-error"
        >
          {t(error)}
        </p>
      )}
    </div>
  );
}
