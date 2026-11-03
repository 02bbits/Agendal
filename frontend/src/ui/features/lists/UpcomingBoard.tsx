import type { ReactElement } from "react";
import { PlusIcon } from "../../components/icons";
import { t } from "../../copy";
import { dayHeading, dayHeadingShort } from "../../domain/week";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";
import type { UpcomingBoardProps } from "./types";

export function UpcomingBoard({
  days,
  tasksByDay,
  today,
  selectedTaskId,
  navigate,
  onAddTask,
}: UpcomingBoardProps): ReactElement {
  const store = useTaskStore();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
      {days.map((date) => {
        const shortHeading = dayHeadingShort(date, today);
        const fullHeading = dayHeading(date, today);
        const dayTasks = tasksByDay[date] ?? [];
        const count = dayTasks.length;

        return (
          <section
            key={date}
            aria-label={fullHeading}
            className="flex w-[272px] shrink-0 snap-start flex-col"
          >
            <div className="flex items-baseline justify-between gap-1.5 pb-2">
              <h2
                id={"day-" + date}
                className="m-0 scroll-mt-[120px] text-callout font-semibold text-ink-secondary"
              >
                {shortHeading}
              </h2>
              <span className="text-footnote font-normal text-ink-tertiary">
                {count}
              </span>
            </div>

            {dayTasks.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
                <ul className="m-0 list-none p-0">
                  {dayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      project={store.projectOf(task)}
                      today={today}
                      timeFormat={store.timeFormat}
                      onToggle={store.toggle}
                      navigate={navigate}
                      selected={task.id === selectedTaskId}
                      settling={store.isSettling(task.id)}
                    />
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => onAddTask(date)}
              aria-label={t("list.add_task_on", { day: fullHeading })}
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
