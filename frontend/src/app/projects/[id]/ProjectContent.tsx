"use client";

import { useMemo } from "react";
import {
  ProjectScreen,
  TaskPanel,
  useTaskPanel,
  useTaskStore,
  type Navigate,
  type Project,
  type Task,
  type TimeFormat,
  type WeekStart,
} from "@/ui";
import type { ProjectTaskAction } from "@/ui/features/projects/DeleteProjectDialog";
import { useAppFrame } from "../../AppFrame";
import { liveProgress } from "./projectProgress";

const idsOf = (tasks: Task[]) => new Set(tasks.map((t) => t.id));

/**
 * A project's tasks from the task store, with the task panel beside them on a wide screen. A
 * task moved to another project leaves this screen; a task just completed stays in Open with
 * its tick while it settles, like the Inbox (LV-1).
 */
export function ProjectContent({
  project,
  initialProgress,
  initialOpen,
  initialCompleted,
  hasMoreCompleted,
  onLoadMoreCompleted,
  loadingMore,
  today,
  timeFormat,
  weekStart,
  allProjects,
  onBack,
  onRenameProject,
  onDeleteProject,
  navigate,
}: {
  project: Project;
  initialProgress: { done: number; total: number };
  initialOpen: Task[];
  initialCompleted: Task[];
  hasMoreCompleted: boolean;
  onLoadMoreCompleted: () => Promise<void>;
  loadingMore: boolean;
  today: string;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  allProjects: Project[];
  onBack: () => void;
  onRenameProject?: () => void;
  onDeleteProject?: (action: ProjectTaskAction) => Promise<void>;
  navigate: Navigate;
}) {
  const { settings } = useAppFrame();
  const store = useTaskStore();
  const panel = useTaskPanel(navigate);
  const initialOpenIds = useMemo(() => idsOf(initialOpen), [initialOpen]);
  const initialCompletedIds = useMemo(
    () => idsOf(initialCompleted),
    [initialCompleted],
  );

  const isNoProject = project.id === "none";
  const tasks = store.tasks.filter((t) =>
    isNoProject ? !t.project_id : t.project_id === project.id,
  );
  const openTasks = tasks.filter((t) => !t.done || store.isSettling(t.id));
  const completedTasks = tasks.filter((t) => t.done && !store.isSettling(t.id));
  const progress = liveProgress({
    initial: initialProgress,
    initialOpenIds,
    initialCompletedIds,
    tasks,
    openCount: openTasks.length,
    isSettling: store.isSettling,
  });

  return (
    <>
      <ProjectScreen
        project={project}
        progress={progress}
        openTasks={openTasks}
        completedTasks={completedTasks}
        hasMoreCompleted={hasMoreCompleted}
        onLoadMoreCompleted={onLoadMoreCompleted}
        loadingMore={loadingMore}
        today={today}
        timeFormat={timeFormat}
        onToggleTask={(task) => store.toggle(task)}
        isSettling={store.isSettling}
        onBack={onBack}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
        navigate={panel.navigate}
        selectedTaskId={panel.selectedTaskId}
      />
      {panel.isWide && panel.selectedTaskId && (
        <TaskPanel
          variant={settings.pageView === "full" ? "aside" : "popup"}
          taskId={panel.selectedTaskId}
          onClose={panel.closePanel}
          projects={allProjects.length > 0 ? allProjects : [project]}
          weekStart={weekStart}
        />
      )}
    </>
  );
}
