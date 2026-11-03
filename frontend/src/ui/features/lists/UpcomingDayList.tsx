import type { ReactElement } from "react";
import { cx } from "../../components/cx";
import { PlusIcon } from "../../components/icons";
import { t } from "../../copy";
import { dayHeading } from "../../domain/week";
import { TASK_COLUMN_CLASS } from "../tasks/layout";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";
import type { UpcomingDayListProps } from "./types";

export function UpcomingDayList({
  days,
  tasksByDay,
  today,
  selectedTaskId,
  navigate,
  onAddTask,
}: UpcomingDayListProps): ReactElement {
  const store = useTaskStore();

  return (
    <div className={cx("space-y-6", TASK_COLUMN_CLASS)}>
      {days.map((date) => {
        const heading = dayHeading(date, today);
        const dayTasks = tasksByDay[date] ?? [];

        return (
          <section key={date} aria-label={heading}>
            <h2
              id={"day-" + date}
              className="scroll-mt-[120px] border-b border-separator pb-1.5 pt-6 text-callout font-semibold text-ink-secondary"
            >
              {heading}
            </h2>

            {dayTasks.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
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
