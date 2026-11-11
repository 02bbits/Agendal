import { useId, useRef, type ReactElement } from "react";
import type { WeekStart } from "../domain/types";
import { t } from "../copy";
import { cx } from "./cx";
import { DatePicker } from "./DatePicker";
import { display, toIso, type Segment } from "./dateSegments";
import { useDateField } from "./useDateField";

export interface DateFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  onCommit?: (value: string) => void;
  onCancel?: () => void;
  onLeave?: () => void;
  weekStart: WeekStart;
  autoFocus?: boolean;
  className?: string;
}

export function DateField({
  label,
  value,
  onChange,
  onCommit,
  onCancel,
  onLeave,
  weekStart,
  autoFocus,
  className,
}: DateFieldProps): ReactElement {
  const autoId = useId();
  const labelId = `datefield-label-${autoId}`;
  const errorId = `datefield-error-${autoId}`;
  const calendarOpen = useRef(false);

  const {
    segments,
    focusedSegment,
    setFocusedSegment,
    error,
    getRef,
    onSegmentKeyDown,
    applyIso,
  } = useDateField({
    value,
    onChange,
    onCommit,
    onCancel,
    autoFocus,
  });

  const renderSegment = (seg: Segment) => {
    const d = display(seg, segments[seg]);
    const isFocused = focusedSegment === seg;
    const labelKey =
      seg === "day" ? "date.day" : seg === "month" ? "date.month" : "date.year";
    const numValue = segments[seg] ? parseInt(segments[seg], 10) : undefined;
    const valueText = segments[seg] ? `${d.text}${d.placeholder}` : undefined;

    return (
      <span
        ref={getRef(seg)}
        role="spinbutton"
        tabIndex={0}
        aria-label={t(labelKey)}
        aria-valuenow={numValue}
        aria-valuemin={seg === "year" ? 1900 : 1}
        aria-valuemax={seg === "day" ? 31 : seg === "month" ? 12 : 2100}
        aria-valuetext={valueText}
        onFocus={() => setFocusedSegment(seg)}
        onBlur={() => setFocusedSegment((cur) => (cur === seg ? null : cur))}
        onKeyDown={(e) => onSegmentKeyDown(seg, e)}
        className={cx(
          "px-1 py-0.5 outline-none select-none",
          isFocused && "rounded-[6px] bg-fill ring-2 ring-ink/30",
        )}
      >
        {!segments[seg] ? (
          <span className="text-ink-tertiary">{t(d.placeholderKey!)}</span>
        ) : seg === "year" && d.placeholder ? (
          <>
            <span>{d.text}</span>
            <span className="text-ink-tertiary">{d.placeholder}</span>
          </>
        ) : (
          <span>{d.text}</span>
        )}
      </span>
    );
  };

  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        onBlur={(e) => {
          if (calendarOpen.current) return;
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          onLeave?.();
        }}
        className={cx(
          "flex h-11 w-full items-center rounded-field border border-control bg-surface px-3 text-body text-ink tabular-nums",
          focusedSegment !== null && "border-primary",
        )}
      >
        <div className="flex items-center">
          {renderSegment("day")}
          <span aria-hidden="true" className="text-ink-tertiary select-none">
            /
          </span>
          {renderSegment("month")}
          <span aria-hidden="true" className="text-ink-tertiary select-none">
            /
          </span>
          {renderSegment("year")}
        </div>

        <div className="ml-auto flex items-center">
          <DatePicker
            label={t("date.open_calendar")}
            value={toIso(segments)}
            onChange={applyIso}
            weekStart={weekStart}
            variant="icon"
            onOpenChange={(o) => {
              calendarOpen.current = o;
            }}
          />
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="m-0 text-footnote text-error">
          {error}
        </p>
      )}
    </div>
  );
}
