import type { ReactElement } from "react";
import { cx } from "../../components/cx";
import { t } from "../../copy";
import { dayHeading, stripLabel } from "../../domain/week";
import type { UpcomingDayStripProps } from "./types";

export function UpcomingDayStrip({
  week,
  today,
  activeDay,
  countsByDay,
  onPickDay,
}: UpcomingDayStripProps): ReactElement {
  const currentActive = activeDay ?? today;

  return (
    <div
      role="group"
      aria-label={t("list.week_days")}
      className="grid grid-cols-7 gap-1 pt-1"
    >
      {week.map((date) => {
        const isToday = date === today;
        const isActive = date === currentActive;
        const isPast = date < today;
        const count = countsByDay[date] ?? 0;
        const hasTasks = count > 0;
        const heading = dayHeading(date, today);
        const { weekday, day } = stripLabel(date);
        const ariaCurrent = isToday ? "date" : isActive ? "true" : undefined;

        return (
          <button
            key={date}
            type="button"
            disabled={isPast || isToday}
            onClick={() => onPickDay(date)}
            aria-current={ariaCurrent}
            aria-label={t("list.day_with_count", { day: heading, count })}
            className={cx(
              "focus-ring relative flex flex-col items-center justify-start rounded-xl border-0 bg-transparent py-1.5 transition-colors min-h-[58px]",
              "[html[data-page-view='full']_&]:md:flex-row [html[data-page-view='full']_&]:md:items-center [html[data-page-view='full']_&]:md:justify-center [html[data-page-view='full']_&]:md:gap-1.5 [html[data-page-view='full']_&]:md:min-h-0 [html[data-page-view='full']_&]:md:py-2",
              isPast || isToday ? "cursor-default" : "cursor-pointer row-hover",
              isPast && "opacity-50",
            )}
          >
            <div className="flex flex-col items-center justify-center whitespace-nowrap [html[data-page-view='full']_&]:md:flex-row [html[data-page-view='full']_&]:md:gap-1.5">
              <span
                className={cx(
                  "text-footnote",
                  isPast
                    ? "text-ink-tertiary"
                    : isToday || isActive
                      ? "font-semibold text-ink"
                      : "text-ink-secondary",
                )}
              >
                {weekday}
              </span>

              {isToday ? (
                <span className="rounded-md bg-fill px-1.5 text-footnote font-semibold text-ink">
                  {day}
                </span>
              ) : isActive ? (
                <span className="rounded-md bg-primary px-1.5 text-footnote font-semibold text-primary-content">
                  {day}
                </span>
              ) : (
                <span
                  className={cx(
                    "text-footnote",
                    isPast ? "text-ink-tertiary" : "text-ink-secondary",
                  )}
                >
                  {day}
                </span>
              )}
            </div>

            <div className="mt-1 flex h-1.5 justify-center [html[data-page-view='full']_&]:md:mt-0 [html[data-page-view='full']_&]:md:order-3">
              {hasTasks && (
                <span
                  aria-hidden="true"
                  data-testid="day-dot"
                  className={cx(
                    "block size-1.5 rounded-full",
                    isActive ? "bg-primary" : "bg-ink-tertiary",
                  )}
                />
              )}
            </div>

            {/* Under the dot for phone/flat view; inline on full width desktop */}
            {isToday && (
              <span className="mt-0.5 whitespace-nowrap text-tab font-medium text-ink-tertiary [html[data-page-view='full']_&]:md:mt-0 [html[data-page-view='full']_&]:md:text-footnote [html[data-page-view='full']_&]:md:font-normal [html[data-page-view='full']_&]:md:order-2">
                {t("list.strip_today")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
