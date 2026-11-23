import type {
  DeleteProjectHandler,
  LoadMoreCompletedHandler,
} from "../../domain/projects";
import type { Project, Task, TimeFormat } from "../../domain/types";
import type { Navigate } from "../shell/routes";
import type { ProjectDropData } from "../lists/dnd/dropTargets";
import type { Receive } from "../lists/dnd/TaskDndScope";

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
  /** Rows are sorted as given but drawn with this task's latest data (frozen sort, Spec 01 §5). */
  liveTask?: (task: Task) => Task;
  /** Sort by rules for this project (#178); without it the sort menu isn't shown. */
  onSortByRules?: () => void;
  /** A task dropped elsewhere in the open list (#178). */
  onMove?: (shown: Task[], id: string, to: number) => void;
  onReceiveOpen?: (shown: Task[], drop: Receive) => void;
  onMoveCompleted?: (shown: Task[], id: string, to: number) => void;
  onReceiveCompleted?: (shown: Task[], drop: Receive) => void;
  onToProject?: (id: string, project: ProjectDropData) => void;
}
