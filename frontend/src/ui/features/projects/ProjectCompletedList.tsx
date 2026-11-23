import { useState } from "react";
import { TextButton } from "../../components/TextButton";
import { t } from "../../copy";
import type { Project, Task, TimeFormat } from "../../domain/types";
import type { LoadMoreCompletedHandler } from "../../domain/projects";
import type { Navigate } from "../shell/routes";
import { SortableTaskList } from "../lists/dnd/SortableTaskList";
import type { Receive } from "../lists/dnd/TaskDndScope";
import type { ProjectDropData } from "../lists/dnd/dropTargets";
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
  onMove?: (shown: Task[], id: string, to: number) => void;
  onReceive?: (shown: Task[], drop: Receive) => void;
  onToProject?: (id: string, project: ProjectDropData) => void;
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
  onMove,
  onReceive,
  onToProject,
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
          <SortableTaskList
            list={`project:${project.id}:completed`}
            tasks={visibleCompleted}
            onMove={(id, to) => onMove?.(visibleCompleted, id, to)}
            onReceive={onReceive ? (drop) => onReceive(visibleCompleted, drop) : undefined}
            onToProject={onToProject}
          >
            {(x, drag) => (
              <TaskRow
                key={x.id}
                drag={drag}
                task={x}
                project={project}
                today={today}
                timeFormat={timeFormat}
                selected={x.id === selectedTaskId}
                onToggle={onToggleTask ?? (() => {})}
                navigate={navigate}
              />
            )}
          </SortableTaskList>
        </ul>
      </div>
      {hasMore && (
        // The same look as Show more results and Load more elsewhere (#168)
        <TextButton
          className="mt-3 w-full"
          busy={loadingMore}
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
        </TextButton>
      )}
    </div>
  );
}
