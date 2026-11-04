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
import { DeleteTask } from "../DeleteTask";
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
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined" && !triggerRef.current) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    }
    return () => {
      triggerRef.current?.focus();
    };
  }, []);

  // While the panel is open, the shell's bottom bar (Write a note, tabs) stops
  // short of it instead of covering Clear and Delete (see AppShell).
  // Also intercepts wheel and touchmove events outside the panel to prevent
  // the background page from scrolling without mutating html/body overflow,
  // which preserves sticky sidebar and header positioning (UX-28).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.taskPanel = "open";

    const aside = panelRef.current;

    const onWheel = (e: WheelEvent) => {
      const isInside = e.target instanceof Node && aside?.contains(e.target);
      if (!isInside) {
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const isInside = e.target instanceof Node && aside?.contains(e.target);
      if (!isInside) {
        e.preventDefault();
      }
    };

    const onWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
        return;
      }
      if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(
          e.key,
        )
      ) {
        if (!aside || !aside.contains(document.activeElement)) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onWindowKeyDown);

    return () => {
      delete root.dataset.taskPanel;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [onClose]);

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
    <>
      <div
        data-testid="task-panel-backdrop"
        aria-hidden="true"
        onClick={onClose}
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
        className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px] transition-opacity duration-200"
      />
      <aside
        ref={panelRef}
        aria-label={t("task.heading")}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-separator bg-surface pr-[env(safe-area-inset-right,0px)] overflow-y-auto overscroll-contain outline-none motion-safe:animate-panel-in will-change-transform shadow-2xl"
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
            deleteAction={
              <DeleteTask
                task={task}
                onDeleted={onDelete ?? onClose}
                label={t("common.delete")}
              />
            }
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
    </>
  );
}
