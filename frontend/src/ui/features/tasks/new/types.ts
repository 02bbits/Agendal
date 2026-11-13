import type {
  Task,
  Project,
  Priority,
  TimeFormat,
  WeekStart,
} from "../../../domain/types";
import type { CreateTaskBody, DueChip } from "../../../domain/newTask";

export interface NewTaskSheetProps {
  open: boolean;
  onClose: () => void;
  pathname?: string;
  today?: string;
  initialStartDate?: string;
  projects?: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  onCreate?: (body: CreateTaskBody) => Promise<Task>;
  onAdded?: (title: string) => void;
  weekStart?: WeekStart;
  timeFormat?: TimeFormat;
}

export interface DueChipsProps {
  value: DueChip;
  picked: string;
  onChange: (chip: DueChip) => void;
  onPickedChange: (picked: string) => void;
  onCancelPick: () => void;
  weekStart?: WeekStart;
}

export interface PriorityChipsProps {
  value: Priority;
  onChange: (priority: Priority) => void;
}

export interface DiscardDialogProps {
  open: boolean;
  /** Defaults to "Discard changes?" */
  title?: string;
  description?: string;
  onDiscard: () => void;
  onKeepEditing: () => void;
}
