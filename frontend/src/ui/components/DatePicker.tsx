import { useId, type ReactElement } from "react";
import { today as getToday } from "@/lib/clock";
import { formatDay } from "../domain/dates";
import { dueDateFor } from "../domain/newTask";
import { t } from "../copy";
import { cx } from "./cx";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";
import { PopoverOrSheet } from "./PopoverOrSheet";
import { Chip } from "./Chip";
import { buildMonthGrid, getWeekdayLabels } from "./calendar";
import { CalendarMonth } from "./CalendarMonth";
import {
  useDatePickerKeyboard,
  type DatePickerProps,
} from "./useDatePickerKeyboard";

export type { DatePickerProps };

export function DatePicker({
  label,
  value,
  onChange,
  weekStart = "mon",
  variant = "panel",
  disabled = false,
  helper,
  id,
  className,
}: DatePickerProps): ReactElement {
  const autoId = useId();
  const pickerId = id ?? `datepicker-${autoId}`;
  const helperId = helper ? `${pickerId}-helper` : undefined;
  const todayStr = getToday();

  const {
    open,
    setOpen,
    viewMonth,
    setViewMonth,
    focusedDate,
    triggerRef,
    dayRefs,
    selectAndClose,
    onDayKeyDown,
    onTriggerKeyDown,
  } = useDatePickerKeyboard({
    value,
    todayDate: todayStr,
    weekStart,
    onChange,
    disabled,
  });

  const isScreen = variant === "screen" || variant === "row";
  const displayValue = value ? formatDay(value, todayStr) : label;
  const todayDate = dueDateFor("today", todayStr)!;
  const tomorrowDate = dueDateFor("tomorrow", todayStr)!;
  const nextWeekDate = dueDateFor("next_week", todayStr)!;

  return (
    <div className={cx("inline-flex flex-col", className)}>
      <PopoverOrSheet
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        triggerRef={triggerRef}
        align={isScreen ? "right" : "left"}
        popoverClassName="w-[308px] p-3"
        trigger={
          <button
            ref={triggerRef}
            id={pickerId}
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-describedby={helperId}
            disabled={disabled}
            onClick={() => !disabled && setOpen((o) => !o)}
            onKeyDown={onTriggerKeyDown}
            className={cx(
              "focus-ring cursor-pointer border-0 text-ink focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
              isScreen
                ? "relative inline-flex items-center justify-end gap-1 bg-transparent py-1 pr-5 text-right text-body text-ink-secondary"
                : "relative inline-flex items-center gap-1.5 rounded-full bg-fill py-1 pl-3 pr-6 text-footnote font-medium",
            )}
          >
            <span className={cx(isScreen && "text-ink-secondary")}>
              {displayValue}
            </span>
            {isScreen ? (
              <ChevronRightIcon
                size={16}
                className="pointer-events-none absolute right-0 text-ink-tertiary"
              />
            ) : (
              <ChevronDownIcon
                size={14}
                className="pointer-events-none absolute right-2 text-ink-secondary"
              />
            )}
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Chip
              selected={value === todayDate}
              onClick={() => selectAndClose(todayDate)}
            >
              {t("date.today")}
            </Chip>
            <Chip
              selected={value === tomorrowDate}
              onClick={() => selectAndClose(tomorrowDate)}
            >
              {t("date.tomorrow")}
            </Chip>
            <Chip
              selected={value === nextWeekDate}
              onClick={() => selectAndClose(nextWeekDate)}
            >
              {t("task.next_week")}
            </Chip>
          </div>

          <CalendarMonth
            viewMonth={viewMonth}
            setViewMonth={setViewMonth}
            weekdayLabels={getWeekdayLabels(weekStart)}
            weeks={buildMonthGrid(viewMonth, weekStart, todayStr, value)}
            value={value}
            focusedDate={focusedDate}
            disabled={disabled}
            dayRefs={dayRefs}
            onDayKeyDown={onDayKeyDown}
            selectAndClose={selectAndClose}
          />
        </div>
      </PopoverOrSheet>
      {helper && (
        <p id={helperId} className="mt-1 text-footnote text-ink-secondary">
          {helper}
        </p>
      )}
    </div>
  );
}
