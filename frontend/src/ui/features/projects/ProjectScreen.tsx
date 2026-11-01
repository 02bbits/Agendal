import { useState } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { IconButton } from "../../components/IconButton";
import { TrashIcon } from "../../components/icons";
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
  navigate?: Navigate;
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
  navigate,
}: ProjectScreenProps) {
  const [shown, setShown] = useState(COMPLETED_PAGE);
  const [deleting, setDeleting] = useState(false);

  const open = sortOpenByDue(openTasks);
  const completed = sortCompleted(completedTasks);
  const totalTasks = openTasks.length + completedTasks.length;
  const hasMore =
    explicitHasMoreCompleted !== undefined
      ? explicitHasMoreCompleted
      : shown < completed.length;
  const visibleCompleted =
    onLoadMoreCompleted !== undefined ? completed : completed.slice(0, shown);

  const progress = explicitProgress ?? {
    done: completedTasks.length,
    total: totalTasks,
  };
  const share = progress.total ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="pb-8">
      <NavBar
        backLabel={t("common.back")}
        onBack={onBack}
        actions={
          <IconButton
            plain
            label={t("project.delete")}
            icon={<TrashIcon size={20} />}
            onClick={() => setDeleting(true)}
          />
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
          )}
          {completed.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 flex items-baseline gap-1.5 text-heading font-semibold">
                {t("list.completed")}
              </h2>
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
              {hasMore && (
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={loadingMore}
                  onClick={async () => {
                    if (onLoadMoreCompleted) {
                      await onLoadMoreCompleted();
                    } else {
                      setShown((n) => n + 50);
                    }
                  }}
                >
                  {t("project.show_completed")}
                </Button>
              )}
            </>
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
