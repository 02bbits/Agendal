import { useState, type ChangeEvent, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { ClockIcon } from "../../../components/icons";
import { t, type CopyKey } from "../../../copy";
import { scheduleError } from "../../../domain/edit";

export interface ScheduleFieldsProps {
  startTime: string | null;
  endTime: string | null;
  onSave: (patch: {
    start_time: string | null;
    end_time: string | null;
  }) => void;
  variant?: "panel" | "screen";
}

export function ScheduleFields({
  startTime,
  endTime,
  onSave,
  variant = "panel",
}: ScheduleFieldsProps): ReactElement {
  const [start, setStart] = useState(startTime ?? "");
  const [end, setEnd] = useState(endTime ?? "");
  const [error, setError] = useState<CopyKey | null>(null);
  const [prevStart, setPrevStart] = useState(startTime);
  const [prevEnd, setPrevEnd] = useState(endTime);

  if (startTime !== prevStart || endTime !== prevEnd) {
    setPrevStart(startTime);
    setPrevEnd(endTime);
    setStart(startTime ?? "");
    setEnd(endTime ?? "");
    setError(scheduleError(startTime, endTime));
  }

  const handleStartChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextStart = e.target.value;
    setStart(nextStart);
    if (!nextStart) {
      setEnd("");
      setError(null);
      onSave({ start_time: null, end_time: null });
      return;
    }
    const err = scheduleError(nextStart, end || null);
    setError(err);
    if (!err) {
      onSave({ start_time: nextStart, end_time: end || null });
    }
  };

  const handleEndChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextEnd = e.target.value;
    setEnd(nextEnd);
    const err = scheduleError(start || null, nextEnd || null);
    setError(err);
    if (!err) {
      onSave({ start_time: start || null, end_time: nextEnd || null });
    }
  };

  const isScreen = variant === "screen";

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
          <input
            id="task-start"
            type="time"
            aria-label={t("task.start")}
            value={start}
            onChange={handleStartChange}
            className={cx(
              "focus-ring cursor-pointer text-ink focus:outline-none",
              isScreen
                ? "bg-transparent text-body text-ink-secondary"
                : "rounded-full bg-fill px-3 py-1 text-footnote font-medium",
            )}
          />
          <span className="text-ink-secondary" aria-hidden="true">
            {"–"}
          </span>
          <input
            id="task-end"
            type="time"
            aria-label={t("task.end")}
            value={end}
            disabled={!start}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "task-end-error" : undefined}
            onChange={handleEndChange}
            className={cx(
              "focus-ring cursor-pointer text-ink disabled:opacity-40 focus:outline-none",
              isScreen
                ? "bg-transparent text-body text-ink-secondary"
                : "rounded-full bg-fill px-3 py-1 text-footnote font-medium",
            )}
          />
        </div>
      </div>
      {error && (
        <p
          id="task-end-error"
          role="alert"
          className="mt-1 text-footnote text-error"
        >
          {t(error)}
        </p>
      )}
    </div>
  );
}
