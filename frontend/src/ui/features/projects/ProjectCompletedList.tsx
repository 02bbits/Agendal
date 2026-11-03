import { useState } from "react";
import { Button } from "../../components/Button";
import { t } from "../../copy";
import type { Project, Task, TimeFormat } from "../../domain/types";
import type { LoadMoreCompletedHandler } from "../../domain/projects";
import type { Navigate } from "../shell/routes";
import { TaskRow } from "../tasks/TaskRow";

export const COMPLETED_PAGE = 10;

export function dedupeTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

export interface ProjectCompletedListProps {
  completed: Task[];
  hasMoreCompleted?: boolean;
  totalDone: number;
  onLoadMoreCompleted?: LoadMoreCompletedHandler;
  loadingMore?: boolean;
  project: Project;
  today: string;
  timeFormat?: TimeFormat;
  selectedTaskId?: string | null;
  onToggleTask?: (task: Task) => void;
  navigate?: Navigate;
}

export function ProjectCompletedList({
  completed,
  hasMoreCompleted,
  totalDone,
  onLoadMoreCompleted,
  loadingMore,
  project,
  today,
  timeFormat = "24h",
  selectedTaskId,
  onToggleTask,
  navigate,
}: ProjectCompletedListProps) {
  const [shown, setShown] = useState(COMPLETED_PAGE);
  const effectiveShown =
    completed.length <= COMPLETED_PAGE ? COMPLETED_PAGE : shown;
  const hasMore =
    effectiveShown < totalDone &&
    (effectiveShown < completed.length || Boolean(hasMoreCompleted));
  const visibleCompleted = completed.slice(0, effectiveShown);

  return (
    <div className="mt-6">
      <h2 className="mb-2 flex items-baseline gap-1.5 text-heading font-semibold">
        {t("list.completed")}
      </h2>
      <div className="rounded-2xl border border-separator/50 bg-surface shadow-xs overflow-hidden">
        <ul className="m-0 list-none p-0">
          {visibleCompleted.map((x) => (
            <TaskRow
              key={x.id}
              task={x}
              project={project}
              today={today}
              timeFormat={timeFormat}
              showDue
              selected={x.id === selectedTaskId}
              onToggle={onToggleTask ?? (() => {})}
              navigate={navigate}
            />
          ))}
        </ul>
      </div>
      {hasMore && (
        <Button
          variant="secondary"
          className="mt-3 w-full"
          disabled={loadingMore}
          onClick={async () => {
            if (shown < completed.length) {
              setShown((n) => n + COMPLETED_PAGE);
            } else if (onLoadMoreCompleted && hasMoreCompleted) {
              await onLoadMoreCompleted();
              setShown((n) => n + COMPLETED_PAGE);
            }
          }}
        >
          {t("project.show_completed")}
        </Button>
      )}
    </div>
  );
}
