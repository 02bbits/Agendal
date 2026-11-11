import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Button } from "../../../components/Button";
import { cx } from "../../../components/cx";
import { useBackgroundScrollLock } from "../../../components/useBackgroundScrollLock";
import { t } from "../../../copy";
import type { Project, WeekStart } from "../../../domain/types";
import { useTaskStore } from "../store";
import { DeleteTask } from "../DeleteTask";
import { PanelHeader } from "./PanelHeader";
import { TaskDetails } from "./TaskDetails";
import { useModalFocus } from "../../../components/useModalFocus";

export interface TaskPanelProps {
  modal?: boolean;
  variant?: "aside" | "popup";
  taskId: string;
  onClose: () => void;
  projects?: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  onDelete?: () => void;
  weekStart?: WeekStart;
}

export function TaskPanel({
  modal = false,
  variant = "aside",
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
  useModalFocus(panelRef, panelRef, modal, onClose);
  const [missingId, setMissingId] = useState<string | null>(null);
  const loadTask = store.api.get;
  const { ensureTask } = store;

  // Search can open a task that isn't in the list on screen: load it by id
  useEffect(() => {
    if (task || !loadTask) return;
    let cancelled = false;
    loadTask(taskId).then(
      (row) => {
        if (!cancelled) ensureTask(row);
      },
      () => {
        if (!cancelled) setMissingId(taskId);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [task, taskId, loadTask, ensureTask]);

  const loading = !task && Boolean(loadTask) && missingId !== taskId;

  useEffect(() => {
    if (modal) return;
    if (typeof document !== "undefined" && !triggerRef.current) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    }
    return () => {
      triggerRef.current?.focus();
    };
  }, [modal]);

  useBackgroundScrollLock(panelRef);

  // While the panel is open, the shell's bottom bar (Write a note, tabs) stops
  // short of it instead of covering Clear and Delete (see AppShell)
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.taskPanel = "open";

    const onWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      // Esc closes the top layer first, e.g. Search opened over the panel
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      delete root.dataset.taskPanel;
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

  const isPopup = variant === "popup";

  const content = task ? (
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
  ) : loading ? (
    <div
      className={cx("flex flex-col", isPopup ? "h-64" : "h-full")}
      role="status"
      aria-busy="true"
    >
      <PanelHeader onClose={onClose} />
    </div>
  ) : (
    <div className={cx("flex flex-col", isPopup ? "h-64" : "h-full")}>
      <PanelHeader onClose={onClose} />
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-body text-ink-secondary">{t("error.not_found")}</p>
        <Button variant="secondary" onClick={onClose} className="mt-4">
          {t("common.close")}
        </Button>
      </div>
    </div>
  );

  if (isPopup) {
    return (
      <>
        <div
          data-testid="task-panel-backdrop"
          aria-hidden="true"
          onClick={onClose}
          onWheel={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
          className="fixed inset-0 z-40 bg-scrim/60 backdrop-blur-[2px] motion-safe:animate-fade-in"
        />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 pointer-events-none">
          <div
            ref={panelRef as React.RefObject<HTMLDivElement>}
            data-modal-host="true"
            role="dialog"
            aria-modal="true"
            aria-label={t("task.heading")}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="pointer-events-auto flex flex-col w-full max-w-[760px] max-h-[85vh] rounded-2xl border border-separator/60 bg-surface shadow-2xl overflow-y-auto overscroll-contain outline-none motion-safe:animate-scale-in"
          >
            {content}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        data-testid="task-panel-backdrop"
        aria-hidden="true"
        onClick={onClose}
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
        className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px] motion-safe:animate-fade-in"
      />
      <aside
        ref={panelRef}
        data-modal-host={modal ? true : undefined}
        role={modal ? "dialog" : undefined}
        aria-modal={modal ? true : undefined}
        aria-label={t("task.heading")}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        // A modal panel hosts its popovers; a transform would make their fixed position relative to it
        className={cx(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-separator bg-surface pr-[env(safe-area-inset-right,0px)] overflow-y-auto overscroll-contain outline-none motion-safe:animate-panel-in shadow-2xl",
          !modal && "will-change-transform",
        )}
      >
        {content}
      </aside>
    </>
  );
}
