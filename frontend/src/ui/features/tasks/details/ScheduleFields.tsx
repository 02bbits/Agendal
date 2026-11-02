import { useState, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { ClockIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { t, type CopyKey } from "../../../copy";
import { scheduleError } from "../../../domain/edit";
import type { TimeFormat } from "../../../domain/types";
import { buildTimeOptions } from "./timeOptions";

export interface ScheduleFieldsProps {
  startTime: string | null;
  endTime: string | null;
  timeFormat?: TimeFormat;
  onSave: (patch: {
    start_time: string | null;
    end_time: string | null;
  }) => void;
  variant?: "panel" | "screen";
}

export function ScheduleFields({
  startTime,
  endTime,
  timeFormat = "24h",
  onSave,
  variant = "panel",
}: ScheduleFieldsProps): ReactElement {
  const [start, setStart] = useState(startTime ?? "");
  const [end, setEnd] = useState(endTime ?? "");
  const [error, setError] = useState<CopyKey | null>(() =>
    scheduleError(startTime, endTime),
  );
  const [prevStart, setPrevStart] = useState(startTime);
  const [prevEnd, setPrevEnd] = useState(endTime);

  if (startTime !== prevStart || endTime !== prevEnd) {
    setPrevStart(startTime);
    setPrevEnd(endTime);
    setStart(startTime ?? "");
    setEnd(endTime ?? "");
    setError(scheduleError(startTime, endTime));
  }

  const handleStartChange = (nextStart: string) => {
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

  const handleEndChange = (nextEnd: string) => {
    setEnd(nextEnd);
    if (!nextEnd) {
      setError(null);
      onSave({ start_time: start || null, end_time: null });
      return;
    }
    const err = scheduleError(start || null, nextEnd);
    setError(err);
    if (!err) {
      onSave({ start_time: start || null, end_time: nextEnd });
    }
  };

  const isScreen = variant === "screen";
  const startOptions = buildTimeOptions(null, start, timeFormat);
  const endOptions = buildTimeOptions(start || null, end, timeFormat);

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
            id="task-end"
            label={t("task.end")}
            value={end}
            options={endOptions}
            disabled={!start}
            onChange={handleEndChange}
            variant={variant}
            ariaDescribedBy={error ? "task-end-error" : undefined}
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
