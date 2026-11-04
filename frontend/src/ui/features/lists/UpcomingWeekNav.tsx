import type { ReactElement } from "react";
import { DatePicker } from "../../components/DatePicker";
import { ChevronLeftIcon, ChevronRightIcon } from "../../components/icons";
import { t } from "../../copy";
import type { UpcomingWeekNavProps } from "./types";

export function UpcomingWeekNav({
  monthLabel,
  pickedDate,
  weekStart,
  weekLabel,
  prevDisabled,
  overdueCount,
  onPrev,
  onNext,
  onPickDate,
  onOverdue,
}: UpcomingWeekNavProps): ReactElement {
  return (
    <div className="flex items-center justify-between py-2">
      <DatePicker
        label={monthLabel}
        triggerLabel={monthLabel}
        value={pickedDate}
        onChange={onPickDate}
        weekStart={weekStart}
        todayChip={{
          label: t("list.overdue"),
          disabled: overdueCount === 0,
          onSelect: onOverdue,
        }}
      />

      <div className="inline-flex w-[200px] items-center justify-between rounded-full border border-separator/60 bg-surface p-0.5 shadow-2xs">
        <button
          type="button"
          aria-label={t("list.prev_week")}
          disabled={prevDisabled}
          onClick={onPrev}
          className="focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary transition-colors hover:text-ink disabled:cursor-default disabled:opacity-40"
        >
          <ChevronLeftIcon size={16} />
        </button>
        <span className="h-4 w-px shrink-0 bg-separator/60" aria-hidden="true" />
        <span
          className="flex-1 truncate px-2 text-center text-footnote font-medium text-ink-secondary"
          aria-live="polite"
        >
          {weekLabel}
        </span>
        <span className="h-4 w-px shrink-0 bg-separator/60" aria-hidden="true" />
        <button
          type="button"
          aria-label={t("list.next_week")}
          onClick={onNext}
          className="focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary transition-colors hover:text-ink"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}
