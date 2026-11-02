import { useState } from "react";
import { t } from "../../copy";
import { EmptyState } from "../../components/EmptyState";
import { NavBar } from "../../components/NavBar";
import {
  sortCompleted,
  sortOpenByDue,
  type DeleteProjectHandler,
  type LoadMoreCompletedHandler,
} from "../../domain/projects";
import type { Project, Task, TimeFormat } from "../../domain/types";
import type { Navigate } from "../shell/routes";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { ProjectHeaderMenu } from "./ProjectHeaderMenu";
import { ProjectOpenList } from "./ProjectOpenList";
import { ProjectProgressBar } from "./ProjectProgressBar";
import {
  COMPLETED_PAGE,
  dedupeTasks,
  ProjectCompletedList,
} from "./ProjectCompletedList";

export { COMPLETED_PAGE };

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
  onDeleteProject?: DeleteProjectHandler;
  onRenameProject?: () => void;
  navigate?: Navigate;
  selectedTaskId?: string | null;
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
  selectedTaskId,
}: ProjectScreenProps) {
  const [deleting, setDeleting] = useState(false);

  const open = dedupeTasks(sortOpenByDue(openTasks));
  const completed = dedupeTasks(sortCompleted(completedTasks));
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
      <NavBar
        backLabel={t("common.back")}
        onBack={onBack}
        actions={
          <ProjectHeaderMenu
            onRename={onRenameProject}
            onDelete={onDeleteProject ? () => setDeleting(true) : undefined}
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
      <div className="w-full max-w-[720px] xl:max-w-[min(720px,calc(100vw-248px-400px-80px))]">
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
              navigate={navigate}
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
