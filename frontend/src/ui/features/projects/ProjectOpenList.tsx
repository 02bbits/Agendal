import type { Project, Task, TimeFormat } from "../../domain/types";
import type { Navigate } from "../shell/routes";
import { TaskRow } from "../tasks/TaskRow";

export interface ProjectOpenListProps {
  tasks: Task[];
  project: Project;
  today: string;
  timeFormat?: TimeFormat;
  selectedTaskId?: string | null;
  onToggleTask?: (task: Task) => void;
  navigate?: Navigate;
}

export function ProjectOpenList({
  tasks,
  project,
  today,
  timeFormat = "24h",
  selectedTaskId,
  onToggleTask,
  navigate,
}: ProjectOpenListProps) {
  if (tasks.length === 0) return null;
  return (
    <div className="rounded-2xl border border-separator/50 bg-surface shadow-xs overflow-hidden">
      <ul className="m-0 list-none p-0">
        {tasks.map((x) => (
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
  );
}
