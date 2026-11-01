import type { Task, Project, Priority } from "../../../domain/types";
import type { CreateTaskBody, DueChip } from "../../../domain/newTask";

export interface NewTaskSheetProps {
  open: boolean;
  onClose: () => void;
  pathname?: string;
  today?: string;
  projects?: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  onCreate?: (body: CreateTaskBody) => Promise<Task>;
  onAdded?: (title: string) => void;
}

export interface DueChipsProps {
  value: DueChip;
  picked: string;
  onChange: (chip: DueChip) => void;
  onPickedChange: (picked: string) => void;
  onCancelPick: () => void;
}

export interface PriorityChipsProps {
  value: Priority;
  onChange: (priority: Priority) => void;
}

export interface DiscardDialogProps {
  open: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}
