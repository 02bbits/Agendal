import { useState, type ChangeEvent, type ReactElement } from "react";
import { t, type CopyKey } from "../../../copy";
import { scheduleError } from "../../../domain/edit";

export interface ScheduleFieldsProps {
  startTime: string | null;
  endTime: string | null;
  onSave: (patch: {
    start_time: string | null;
    end_time: string | null;
  }) => void;
}

export function ScheduleFields({
  startTime,
  endTime,
  onSave,
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="task-start"
          className="text-footnote font-medium text-ink-secondary"
        >
          {t("task.start")}
        </label>
        <input
          id="task-start"
          type="time"
          value={start}
          className="input focus-ring h-[52px] w-full rounded-field border-control bg-surface px-4 text-body text-ink"
          onChange={handleStartChange}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="task-end"
          className="text-footnote font-medium text-ink-secondary"
        >
          {t("task.end")}
        </label>
        <input
          id="task-end"
          type="time"
          value={end}
          disabled={!start}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "task-end-error" : undefined}
          className="input focus-ring h-[52px] w-full rounded-field border-control bg-surface px-4 text-body text-ink aria-invalid:border-error disabled:opacity-40"
          onChange={handleEndChange}
        />
        {error && (
          <p
            id="task-end-error"
            role="alert"
            className="m-0 text-footnote text-error"
          >
            {t(error)}
          </p>
        )}
      </div>
    </div>
  );
}
