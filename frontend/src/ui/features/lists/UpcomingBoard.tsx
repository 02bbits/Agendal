import type { ReactElement } from "react";
import { PlusIcon } from "../../components/icons";
import { t } from "../../copy";
import { dayHeading, dayHeadingShort } from "../../domain/week";
import { EntryBlocks } from "./EntryBlocks";
import type { UpcomingBoardProps } from "./types";
import { UpcomingOverdue } from "./UpcomingOverdue";

export function UpcomingBoard({
  days,
  entriesByDay,
  overdueTasks,
  today,
  selectedTaskId,
  navigate,
  onAddTask,
}: UpcomingBoardProps): ReactElement {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
      {overdueTasks && overdueTasks.length > 0 && (
        <UpcomingOverdue
          variant="board"
          tasks={overdueTasks}
          today={today}
          selectedTaskId={selectedTaskId}
          navigate={navigate}
        />
      )}
      {days.map((date) => {
        const shortHeading = dayHeadingShort(date, today);
        const fullHeading = dayHeading(date, today);
        const dayEntries = entriesByDay[date] ?? [];
        const count = dayEntries.length;

        return (
          <section
            key={date}
            aria-label={fullHeading}
            className="flex w-[272px] shrink-0 snap-start flex-col"
          >
            <div className="flex items-baseline justify-between gap-1.5 pb-2">
              <h2
                id={"day-" + date}
                className="m-0 scroll-mt-[calc(var(--upcoming-bar-h,120px)+8px)] text-callout font-semibold text-ink-secondary"
              >
                {shortHeading}
              </h2>
              <span className="text-footnote font-normal text-ink-tertiary">
                {count}
              </span>
            </div>

            {dayEntries.length > 0 && (
              <EntryBlocks
                entries={dayEntries}
                variant="board"
                today={today}
                selectedTaskId={selectedTaskId ?? undefined}
                navigate={navigate}
              />
            )}

            <button
              type="button"
              onClick={() => onAddTask(date)}
              aria-label={t("list.add_task_on", { day: fullHeading })}
              className="focus-ring mt-2 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-callout text-ink-tertiary row-hover hover:text-ink"
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
