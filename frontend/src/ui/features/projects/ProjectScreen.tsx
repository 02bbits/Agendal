import { useState } from "react";
import { t } from "../../copy";
import { EmptyState } from "../../components/EmptyState";
import { BackBar } from "../../components/BackBar";
import { orderList } from "../../domain/order";
import { sortCompleted, sortOpenByDue } from "../../domain/projects";
import { SortMenu } from "../lists/SortMenu";
import { useSortMode } from "../lists/useSortMode";
import { TASK_COLUMN_CLASS } from "../tasks/layout";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { ProjectHeaderMenu } from "./ProjectHeaderMenu";
import { ProjectOpenList } from "./ProjectOpenList";
import { ProjectProgressBar } from "./ProjectProgressBar";
import {
  COMPLETED_PAGE,
  dedupeTasks,
  ProjectCompletedList,
} from "./ProjectCompletedList";
import type { ProjectScreenProps } from "./types";

export { COMPLETED_PAGE };
export type { ProjectScreenProps };

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
  isSettling,
  onBack,
  onDeleteProject,
  onRenameProject,
  navigate,
  selectedTaskId,
  liveTask = (task) => task,
  onSortByRules,
  onMove,
}: ProjectScreenProps) {
  const [deleting, setDeleting] = useState(false);

  const [sortMode] = useSortMode(`project:${project.id}`);
  const open = dedupeTasks(
    orderList(openTasks, sortMode, "project_order", sortOpenByDue),
  ).map(liveTask);
  const completed = dedupeTasks(sortCompleted(completedTasks)).map(liveTask);
  const totalTasks = openTasks.length + completedTasks.length;
  const progress = explicitProgress ?? {
    done: completedTasks.length,
    total: totalTasks,
  };
  const totalDone =
    explicitProgress?.done ??
    (explicitHasMoreCompleted ? completed.length + 1 : completed.length);

  return (
    <div className="pb-8">
      <BackBar
        label={t("common.back")}
        onBack={onBack}
        className="-mx-5"
        actions={
          <div className="flex items-center gap-1">
            {onSortByRules && (
              <SortMenu
                list={`project:${project.id}`}
                listName={project.name}
                onSortByRules={onSortByRules}
              />
            )}
            <ProjectHeaderMenu
              onRename={onRenameProject}
              onDelete={onDeleteProject ? () => setDeleting(true) : undefined}
            />
          </div>
        }
      />
      <h1
        className="mt-2 mb-3 flex items-center gap-3 text-title font-semibold focus:outline-none"
        tabIndex={-1}
      >
        <span
          className="inline-block size-3 shrink-0 rounded-full"
          style={{ background: `var(--color-project-${project.colour})` }}
          aria-hidden="true"
        />
        {project.name}
      </h1>
      <div className={TASK_COLUMN_CLASS}>
        <ProjectProgressBar
          colour={project.colour}
          done={progress.done}
          total={progress.total}
        />

        {totalTasks === 0 ? (
          <EmptyState title={t("project.empty")} />
        ) : (
          <>
            <ProjectOpenList
              tasks={open}
              project={project}
              today={today}
              timeFormat={timeFormat}
              selectedTaskId={selectedTaskId}
              onToggleTask={onToggleTask}
              isSettling={isSettling}
              navigate={navigate}
              onMove={onMove}
            />
            {completed.length > 0 && (
              <ProjectCompletedList
                completed={completed}
                hasMoreCompleted={explicitHasMoreCompleted}
                totalDone={totalDone}
                onLoadMoreCompleted={onLoadMoreCompleted}
                loadingMore={loadingMore}
                project={project}
                today={today}
                timeFormat={timeFormat}
                selectedTaskId={selectedTaskId}
                onToggleTask={onToggleTask}
                navigate={navigate}
              />
            )}
          </>
        )}
      </div>

      <DeleteProjectDialog
        open={deleting}
        project={project}
        taskCount={totalTasks}
        onCancel={() => setDeleting(false)}
        onConfirm={async (action) => {
          setDeleting(false);
          await onDeleteProject?.(action);
        }}
      />
    </div>
  );
}
