import type { ReactElement } from "react";
import { DatePicker } from "../../components/DatePicker";
import { ChevronLeftIcon, ChevronRightIcon } from "../../components/icons";
import { t } from "../../copy";
import type { UpcomingWeekNavProps } from "./types";

export function UpcomingWeekNav({
  monthLabel,
  pickedDate,
  weekStart,
  prevDisabled,
  onPrev,
  onToday,
  onNext,
  onPickDate,
}: UpcomingWeekNavProps): ReactElement {
  return (
    <div className="flex items-center justify-between py-2">
      <DatePicker
        label={monthLabel}
        triggerLabel={monthLabel}
        value={pickedDate}
        onChange={onPickDate}
        weekStart={weekStart}
      />

      <div className="inline-flex items-center rounded-full border border-separator/60 bg-surface p-0.5 shadow-2xs">
        <button
          type="button"
          aria-label={t("list.prev_week")}
          disabled={prevDisabled}
          onClick={onPrev}
          className="focus-ring inline-flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary transition-colors hover:text-ink disabled:cursor-default disabled:opacity-40"
        >
          <ChevronLeftIcon size={16} />
        </button>
        <span className="h-4 w-px bg-separator/60" aria-hidden="true" />
        <button
          type="button"
          onClick={onToday}
          className="focus-ring inline-flex h-8 items-center rounded-full border-0 bg-transparent px-3 text-footnote font-medium text-ink-secondary transition-colors hover:text-ink"
        >
          {t("date.today")}
        </button>
        <span className="h-4 w-px bg-separator/60" aria-hidden="true" />
        <button
          type="button"
          aria-label={t("list.next_week")}
          onClick={onNext}
          className="focus-ring inline-flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary transition-colors hover:text-ink"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}
