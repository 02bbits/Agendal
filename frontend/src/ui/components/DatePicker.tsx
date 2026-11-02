import { useId, type ReactElement, type ReactNode } from "react";
import { today as getToday } from "@/lib/clock";
import { formatDay } from "../domain/dates";
import { dueDateFor } from "../domain/newTask";
import type { WeekStart } from "../domain/types";
import { t } from "../copy";
import { cx } from "./cx";
import { PickerTrigger } from "./PickerTrigger";
import { PopoverOrSheet } from "./PopoverOrSheet";
import { Chip } from "./Chip";
import { buildMonthGrid, getWeekdayLabels } from "./calendar";
import { CalendarMonth } from "./CalendarMonth";
import { useDatePickerKeyboard } from "./useDatePickerKeyboard";
import type { PickerVariant } from "./usePickerKeyboard";

export interface DatePickerProps {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  weekStart?: WeekStart;
  variant?: PickerVariant;
  disabled?: boolean;
  helper?: ReactNode;
  id?: string;
  className?: string;
}

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
  const chips = [
    { k: "today", d: dueDateFor("today", todayStr)!, l: t("date.today") },
    {
      k: "tomorrow",
      d: dueDateFor("tomorrow", todayStr)!,
      l: t("date.tomorrow"),
    },
    {
      k: "next_week",
      d: dueDateFor("next_week", todayStr)!,
      l: t("task.next_week"),
    },
  ] as const;

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
          <PickerTrigger
            triggerRef={triggerRef}
            id={pickerId}
            label={label}
            haspopup="dialog"
            open={open}
            describedBy={helperId}
            disabled={disabled}
            isScreen={isScreen}
            onToggle={() => setOpen((o) => !o)}
            onKeyDown={onTriggerKeyDown}
          >
            {displayValue}
          </PickerTrigger>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            {chips.map((c) => (
              <Chip
                key={c.k}
                selected={value === c.d}
                onClick={() => selectAndClose(c.d)}
              >
                {c.l}
              </Chip>
            ))}
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
