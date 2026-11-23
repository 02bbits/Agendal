import type { Project, Task, TimeFormat } from "../../domain/types";
import type { Navigate } from "../shell/routes";
import { SortableTaskList } from "../lists/dnd/SortableTaskList";
import { TaskDndScope, type Receive } from "../lists/dnd/TaskDndScope";
import type { ProjectDropData } from "../lists/dnd/dropTargets";
import { TaskRow } from "../tasks/TaskRow";

export interface ProjectOpenListProps {
  tasks: Task[];
  project: Project;
  today: string;
  timeFormat?: TimeFormat;
  selectedTaskId?: string | null;
  onToggleTask?: (task: Task) => void;
  isSettling?: (id: string) => boolean;
  navigate?: Navigate;
  /** Drag to reorder (#178); without it the rows don't move. */
  onMove?: (shown: Task[], id: string, to: number) => void;
  onReceive?: (shown: Task[], drop: Receive) => void;
  onToProject?: (id: string, project: ProjectDropData) => void;
}

export function ProjectOpenList({
  tasks,
  project,
  today,
  timeFormat = "24h",
  selectedTaskId,
  onToggleTask,
  isSettling,
  navigate,
  onMove,
  onReceive,
  onToProject,
}: ProjectOpenListProps) {
  if (tasks.length === 0) return null;
  const list = (
    <div className="rounded-2xl border border-separator/50 bg-surface shadow-xs overflow-hidden">
      <ul className="m-0 list-none p-0">
        <SortableTaskList
          list={`project:${project.id}`}
          tasks={tasks}
          onMove={(id, to) => onMove?.(tasks, id, to)}
          onReceive={onReceive ? (drop) => onReceive(tasks, drop) : undefined}
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
              settling={isSettling?.(x.id) ?? false}
              onToggle={onToggleTask ?? (() => {})}
              navigate={navigate}
            />
          )}
        </SortableTaskList>
      </ul>
    </div>
  );
  return onMove ? <TaskDndScope>{list}</TaskDndScope> : list;
}
