import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Button } from "../../../components/Button";
import { t } from "../../../copy";
import type { Project, WeekStart } from "../../../domain/types";
import { useTaskStore } from "../store";
import { PanelHeader } from "./PanelHeader";
import { TaskDetails } from "./TaskDetails";

export interface TaskPanelProps {
  taskId: string;
  onClose: () => void;
  projects?: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  onDelete?: () => void;
  weekStart?: WeekStart;
}

export function TaskPanel({
  taskId,
  onClose,
  projects,
  projectsStatus,
  onRetryProjects,
  onDelete,
  weekStart,
}: TaskPanelProps): ReactElement | null {
  const store = useTaskStore();
  const task = store.tasks.find((t) => {
    return t.id === taskId;
  });
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined" && !triggerRef.current) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    }
    return () => {
      triggerRef.current?.focus();
    };
  }, []);

  // While the panel is open, the shell's bottom bar (Write a note, tabs) stops
  // short of it instead of covering Clear and Delete (see AppShell)
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.taskPanel = "open";
    return () => {
      delete root.dataset.taskPanel;
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  return (
    <aside
      aria-label={t("task.heading")}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-y-0 right-0 z-40 flex w-[400px] flex-col border-l border-separator bg-surface pr-[env(safe-area-inset-right,0px)] overflow-y-auto outline-none motion-safe:animate-panel-in will-change-transform"
    >
      {task ? (
        <TaskDetails
          key={task.id}
          task={task}
          onBack={onClose}
          onClose={onClose}
          variant="panel"
          projects={projects}
          projectsStatus={projectsStatus}
          onRetryProjects={onRetryProjects}
          onDelete={onDelete}
          autoFocusTitle
          weekStart={weekStart}
        />
      ) : (
        <div className="flex h-full flex-col">
          <PanelHeader onClose={onClose} />
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <p className="text-body text-ink-secondary">
              {t("error.not_found")}
            </p>
            <Button variant="secondary" onClick={onClose} className="mt-4">
              {t("common.close")}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
