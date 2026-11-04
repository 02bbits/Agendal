import type { ReactElement } from "react";
import { t } from "../../copy";
import type { Task } from "../../domain/types";
import type { Navigate } from "../shell/routes";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";

export interface UpcomingOverdueProps {
  variant: "list" | "board";
  tasks: Task[];
  today: string;
  selectedTaskId?: string | null;
  navigate?: Navigate;
}

export function UpcomingOverdue({
  variant,
  tasks,
  today,
  selectedTaskId,
  navigate,
}: UpcomingOverdueProps): ReactElement | null {
  const store = useTaskStore();
  if (tasks.length === 0) return null;

  const count = tasks.length;
  const overdueTitle = t("list.overdue");

  const rows = (
    <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
      <ul className="m-0 list-none p-0">
        {tasks.map((task) => (
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
            overdue
          />
        ))}
      </ul>
    </div>
  );

  if (variant === "board") {
    return (
      <section
        aria-label={`${overdueTitle} ${count}`}
        className="flex w-[272px] shrink-0 snap-start flex-col"
      >
        <div className="flex items-baseline justify-between gap-1.5 pb-2">
          <h2
            id="day-overdue"
            className="m-0 scroll-mt-[calc(var(--upcoming-bar-h,120px)+8px)] text-callout font-semibold text-error"
          >
            {overdueTitle}
          </h2>
          <span className="text-footnote font-normal text-error">{count}</span>
        </div>
        {rows}
      </section>
    );
  }

  return (
    <section aria-label={`${overdueTitle} ${count}`}>
      <h2
        id="day-overdue"
        className="scroll-mt-[calc(var(--upcoming-bar-h,120px)+8px)] border-b border-separator pb-1.5 pt-6 flex items-baseline gap-1.5 text-callout font-semibold text-error"
      >
        <span>{overdueTitle}</span>
        <span className="font-normal text-ink-tertiary">{count}</span>
      </h2>
      <div className="mt-2">{rows}</div>
    </section>
  );
}
