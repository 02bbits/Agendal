import type { ReactElement } from "react";
import { cx } from "../../components/cx";
import { PlusIcon } from "../../components/icons";
import { t } from "../../copy";
import { dayHeading } from "../../domain/week";
import { TASK_COLUMN_CLASS } from "../tasks/layout";
import { EntryBlocks } from "./EntryBlocks";
import type { UpcomingDayListProps } from "./types";
import { UpcomingOverdue } from "./UpcomingOverdue";

export function UpcomingDayList({
  days,
  entriesByDay,
  overdueTasks,
  today,
  selectedTaskId,
  navigate,
  onAddTask,
}: UpcomingDayListProps): ReactElement {
  return (
    <div className={cx("space-y-6", TASK_COLUMN_CLASS)}>
      {overdueTasks && overdueTasks.length > 0 && (
        <UpcomingOverdue
          variant="list"
          tasks={overdueTasks}
          today={today}
          selectedTaskId={selectedTaskId}
          navigate={navigate}
        />
      )}
      {days.map((date, index) => {
        const heading = dayHeading(date, today);
        const dayEntries = entriesByDay[date] ?? [];
        const isLast = index === days.length - 1;

        return (
          <section
            key={date}
            aria-label={heading}
            className={
              isLast
                ? "min-h-[calc(100dvh-var(--upcoming-bar-h,120px)-var(--upcoming-bottom-h,96px))] max-md:[--upcoming-bottom-h:160px]"
                : undefined
            }
          >
            <h2
              id={"day-" + date}
              className="scroll-mt-[calc(var(--upcoming-bar-h,120px)+8px)] border-b border-separator pb-1.5 pt-6 text-callout font-semibold text-ink-secondary"
            >
              {heading}
            </h2>

            {dayEntries.length > 0 && (
              <div className="mt-2">
                <EntryBlocks
                  entries={dayEntries}
                  variant="list"
                  today={today}
                  selectedTaskId={selectedTaskId ?? undefined}
                  navigate={navigate}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => onAddTask(date)}
              aria-label={t("list.add_task_on", { day: heading })}
              className="focus-ring mt-2 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-callout text-ink-tertiary transition-colors hover:bg-surface-hover/50 hover:text-ink"
            >
              <span className="text-primary">
                <PlusIcon size={16} />
              </span>
              <span>{t("list.add_task")}</span>
            </button>
          </section>
        );
      })}
    </div>
  );
}
