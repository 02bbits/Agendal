import { useState } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PencilIcon, TrashIcon } from "../../components/icons";
import { NavBar } from "../../components/NavBar";
import {
  sortCompleted,
  sortOpenByDue,
  type DeleteProjectHandler,
  type LoadMoreCompletedHandler,
} from "../../domain/projects";
import type { Project, Task, TimeFormat } from "../../domain/types";
import type { Navigate } from "../shell/routes";
import { TaskRow } from "../tasks/TaskRow";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

/** Completed tasks shown before "Show completed" (PJ §2.3). */
export const COMPLETED_PAGE = 10;

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
  onBack: () => void;
  /** After deleting, back to the Projects list (PJ §2.5). */
  onDeleteProject?: DeleteProjectHandler;
  onRenameProject?: () => void;
  navigate?: Navigate;
}

function dedupeTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/** One project's tasks with its progress bar; menu with Delete (PJ-2, PJ-4). */
export function ProjectScreen({
  project,
  progress: explicitProgress,
  openTasks = [],
  completedTasks = [],
  hasMoreCompleted: explicitHasMoreCompleted,
  onLoadMoreCompleted,
  loadingMore = false,
  today,
  timeFormat = "24h",
  onToggleTask,
  onBack,
  onDeleteProject,
  onRenameProject,
  navigate,
}: ProjectScreenProps) {
  const [shown, setShown] = useState(COMPLETED_PAGE);
  const [deleting, setDeleting] = useState(false);

  const open = dedupeTasks(sortOpenByDue(openTasks));
  const completed = dedupeTasks(sortCompleted(completedTasks));
  const totalTasks = openTasks.length + completedTasks.length;
  const progress = explicitProgress ?? {
    done: completedTasks.length,
    total: totalTasks,
  };
  const totalDone = explicitProgress
    ? explicitProgress.done
    : explicitHasMoreCompleted
      ? completed.length + 1
      : completed.length;

  const effectiveShown =
    completed.length <= COMPLETED_PAGE ? COMPLETED_PAGE : shown;

  const hasMore =
    effectiveShown < totalDone &&
    (effectiveShown < completed.length || Boolean(explicitHasMoreCompleted));
  const visibleCompleted = completed.slice(0, effectiveShown);
  const share = progress.total ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="pb-8">
      <NavBar
        backLabel={t("common.back")}
        onBack={onBack}
        actions={
          <div className="flex items-center gap-2">
            {onRenameProject && (
              <Button
                variant="secondary"
                size="sm"
                pill
                className="px-3 py-1.5"
                onClick={onRenameProject}
              >
                <PencilIcon size={14} />
                {t("project.rename")}
              </Button>
            )}
            {onDeleteProject && (
              <Button
                variant="destructive"
                size="sm"
                pill
                className="px-3 py-1.5"
                onClick={() => setDeleting(true)}
              >
                <TrashIcon size={14} />
                {t("project.delete")}
              </Button>
            )}
          </div>
        }
      />
      <h1
        className="mt-2 mb-3 flex items-center gap-3 font-serif text-title font-semibold focus:outline-none"
        tabIndex={-1}
      >
        <span
          className="inline-block size-3 shrink-0 rounded-full"
          style={{ background: `var(--color-project-${project.colour})` }}
          aria-hidden="true"
        />
        {project.name}
      </h1>
      <div className="mb-6 flex flex-col gap-1.5 [&_p]:m-0">
        <span
          className="block h-1.5 overflow-hidden rounded-full bg-fill"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-[inherit]"
            style={{
              width: `${share}%`,
              background: `var(--color-project-${project.colour})`,
            }}
          />
        </span>
        <p className="text-footnote text-ink-secondary">
          {t("project.progress", {
            done: progress.done,
            total: progress.total,
          })}
        </p>
      </div>

      {totalTasks === 0 ? (
        <EmptyState title={t("project.empty")} />
      ) : (
        <>
          {open.length > 0 && (
            <div className="rounded-2xl border border-separator/50 bg-surface shadow-xs overflow-hidden">
              <ul className="m-0 list-none p-0">
                {open.map((x) => (
                  <TaskRow
                    key={x.id}
                    task={x}
                    project={project}
                    today={today}
                    timeFormat={timeFormat}
                    showDue
                    onToggle={onToggleTask ?? (() => {})}
                    navigate={navigate}
                  />
                ))}
              </ul>
            </div>
          )}
          {completed.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 flex items-baseline gap-1.5 text-heading font-semibold">
                {t("list.completed")}
              </h2>
              <div className="rounded-2xl border border-separator/50 bg-surface shadow-xs overflow-hidden">
                <ul className="m-0 list-none p-0">
                  {visibleCompleted.map((x) => (
                    <TaskRow
                      key={x.id}
                      task={x}
                      project={project}
                      today={today}
                      timeFormat={timeFormat}
                      showDue
                      onToggle={onToggleTask ?? (() => {})}
                      navigate={navigate}
                    />
                  ))}
                </ul>
              </div>
              {hasMore && (
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={loadingMore}
                  onClick={async () => {
                    if (shown < completed.length) {
                      setShown((n) => n + COMPLETED_PAGE);
                    } else if (
                      onLoadMoreCompleted &&
                      explicitHasMoreCompleted
                    ) {
                      await onLoadMoreCompleted();
                      setShown((n) => n + COMPLETED_PAGE);
                    }
                  }}
                >
                  {t("project.show_completed")}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <DeleteProjectDialog
        open={deleting}
        project={project}
        taskCount={totalTasks}
        onCancel={() => setDeleting(false)}
        onConfirm={async (action) => {
          setDeleting(false);
          if (onDeleteProject) {
            await onDeleteProject(action);
          }
        }}
      />
    </div>
  );
}
