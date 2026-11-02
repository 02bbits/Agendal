import type {
  DeleteProjectHandler,
  LoadMoreCompletedHandler,
} from "../../domain/projects";
import type { Project, Task, TimeFormat } from "../../domain/types";
import type { Navigate } from "../shell/routes";

export interface ProjectScreenProps {
  project: Project;
  progress?: { done: number; total: number };
  openTasks?: Task[];
  completedTasks?: Task[];
  hasMoreCompleted?: boolean;
  onLoadMoreCompleted?: LoadMoreCompletedHandler;
  loadingMore?: boolean;
  today: string;
  timeFormat?: TimeFormat;
  onToggleTask?: (task: Task) => void;
  /** A task just completed is settling: its tick is locked until it moves down. */
  isSettling?: (id: string) => boolean;
  onBack: () => void;
  onDeleteProject?: DeleteProjectHandler;
  onRenameProject?: () => void;
  navigate?: Navigate;
  selectedTaskId?: string | null;
}
