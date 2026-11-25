"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Project, Task, TimeFormat, WeekStart } from "@/ui/domain/types";
import { ProjectScreen } from "@/ui/features/projects/ProjectScreen";
import type { ProjectTaskAction } from "@/ui/features/projects/DeleteProjectDialog";
import { useFrozenOrder } from "@/ui/features/lists/useFrozenOrder";
import type { Navigate } from "@/ui/features/shell/routes";
import { useTaskStore } from "@/ui/features/tasks/store";
import { useTaskPanel } from "@/ui/features/tasks/useTaskPanel";
import { useAppFrame } from "../../AppFrame";
import { liveProgress } from "./projectProgress";

const TaskPanel = dynamic(
  () =>
    import("@/ui/features/tasks/details/TaskPanel").then((m) => m.TaskPanel),
  { ssr: false },
);

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
  const frozen = useFrozenOrder(store.tasks, panel.selectedTaskId);
  const tasks = frozen.layout.filter((t) =>
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
        liveTask={frozen.live}
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
