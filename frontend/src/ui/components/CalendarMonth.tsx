import type { KeyboardEvent, MutableRefObject, ReactElement } from "react";
import { t } from "../copy";
import { cx } from "./cx";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { formatMonthYear, shiftMonth, type CalendarWeek } from "./calendar";

export interface CalendarMonthProps {
  viewMonth: string;
  setViewMonth: (m: string) => void;
  weekdayLabels: string[];
  weeks: CalendarWeek[];
  value?: string | null;
  focusedDate: string;
  disabled?: boolean;
  dayRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  onDayKeyDown: (e: KeyboardEvent<HTMLButtonElement>, date: string) => void;
  selectAndClose: (date: string) => void;
}

export function CalendarMonth({
  viewMonth,
  setViewMonth,
  weekdayLabels,
  weeks,
  value,
  focusedDate,
  disabled = false,
  dayRefs,
  onDayKeyDown,
  selectAndClose,
}: CalendarMonthProps): ReactElement {
  return (
    <>
      <div className="flex items-center justify-between py-1">
        <button
          type="button"
          aria-label={t("date.prev_month")}
          onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-field text-ink transition-colors hover:bg-fill"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <span className="text-body font-medium text-ink">
          {formatMonthYear(viewMonth)}
        </span>
        <button
          type="button"
          aria-label={t("date.next_month")}
          onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-field text-ink transition-colors hover:bg-fill"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <div
        role="grid"
        aria-label={formatMonthYear(viewMonth)}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7 text-center">
          {weekdayLabels.map((w) => (
            <div
              key={w}
              role="columnheader"
              className="py-1 text-footnote font-medium text-ink-tertiary"
            >
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            role="row"
            className="grid grid-cols-7 place-items-center"
          >
            {week.map((cell) => (
              <button
                key={cell.date}
                ref={(el) => {
                  if (el) dayRefs.current.set(cell.date, el);
                  else dayRefs.current.delete(cell.date);
                }}
                type="button"
                role="gridcell"
                aria-selected={cell.date === value}
                tabIndex={cell.date === focusedDate ? 0 : -1}
                disabled={disabled}
                onClick={() => selectAndClose(cell.date)}
                onKeyDown={(e) => onDayKeyDown(e, cell.date)}
                className={cx(
                  "focus-ring flex h-8 w-8 items-center justify-center rounded-full text-footnote transition-colors",
                  cell.date === value
                    ? "bg-ink font-medium text-paper"
                    : cell.isToday
                      ? "ring-1 ring-ink font-medium text-ink hover:bg-fill"
                      : cell.isCurrentMonth
                        ? "text-ink hover:bg-fill"
                        : "text-ink-tertiary opacity-40 hover:bg-fill",
                )}
              >
                {cell.dayNumber}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
