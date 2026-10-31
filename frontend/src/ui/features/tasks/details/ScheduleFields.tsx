import { useState, type ChangeEvent, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { t, type CopyKey } from "../../../copy";
import { scheduleError } from "../../../domain/edit";
import { Field } from "./Field";
import { CONTROL_CLASS } from "./control";

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

  const fields = [
    {
      id: "task-start",
      label: t("task.start"),
      value: start,
      disabled: false,
      error: undefined,
      onChange: handleStartChange,
    },
    {
      id: "task-end",
      label: t("task.end"),
      value: end,
      disabled: !start,
      error: error ? t(error) : undefined,
      onChange: handleEndChange,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <Field
          key={field.id}
          id={field.id}
          label={field.label}
          error={field.error}
        >
          <input
            id={field.id}
            type="time"
            value={field.value}
            disabled={field.disabled}
            aria-invalid={field.error ? true : undefined}
            aria-describedby={field.error ? `${field.id}-error` : undefined}
            className={cx(
              CONTROL_CLASS,
              "input focus-ring aria-invalid:border-error disabled:opacity-40",
            )}
            onChange={field.onChange}
          />
        </Field>
      ))}
    </div>
  );
}
