"use client";

import { useState } from "react";
import { ProjectSheet, ROUTES, RateLimited, TaskStoreProvider, t } from "@/ui";
import { notifyProjectsChanged } from "@/ui/domain/appEvents";
import type { ProjectTaskAction } from "@/ui/features/projects/DeleteProjectDialog";
import { useToday } from "@/ui/features/tasks/useToday";
import { deleteProject, restoreProject, updateProject } from "@/lib/projectApi";
import { httpTaskApi } from "@/lib/taskApi";
import { useAppFrame } from "../../AppFrame";
import { appClock } from "../../appClock";
import { PageMessage } from "../../PageMessage";
import { ProjectSkeleton } from "../../skeletons";
import { ProjectContent } from "./ProjectContent";
import { useProjectDetail } from "./useProjectDetail";

/** A project's page (PJ), or No project's: its tasks, rename, delete with Undo. */
export function ProjectClient({ id }: { id: string }) {
  const { navigate, showToast, settings } = useAppFrame();
  const isNoProject = id === "none";
  const detail = useProjectDetail(id);
  const { data } = detail;
  const [renaming, setRenaming] = useState(false);
  const today = useToday(appClock);
  const backToProjects = () => navigate(ROUTES.projects);

  const loadMoreCompleted = async () => {
    if (!(await detail.loadMoreCompleted())) showToast(t("error.save_failed"));
  };

  const undoDelete = async (
    projectId: string,
    undo: Parameters<typeof restoreProject>[1],
  ) => {
    if (!data) return;
    try {
      await restoreProject(projectId, undo);
      notifyProjectsChanged();
      showToast(
        t("project.progress", {
          done: data.progress.done,
          total: data.progress.total,
        }),
      );
    } catch {
      showToast(t("error.save_failed"));
    }
  };

  const deleteThis = async (action: ProjectTaskAction) => {
    if (!data) return;
    const { project } = data;
    try {
      const res = await deleteProject(project.id, action);
      notifyProjectsChanged();
      backToProjects();
      showToast({
        message: t("project.deleted", { name: project.name }),
        actionLabel: t("common.undo"),
        onAction: () => undoDelete(project.id, res.undo),
      });
    } catch {
      showToast(t("error.save_failed"));
    }
  };

  // At once, no delay: the tap that opened this page already showed this same skeleton (#161)
  if (detail.loading) return <ProjectSkeleton />;

  if (detail.limited)
    return <RateLimited error={detail.limited} onRetry={detail.retry} />;

  if (detail.error === 404 || !data) {
    return (
      <PageMessage
        message={t("error.not_found")}
        actionLabel={t("common.back")}
        onAction={backToProjects}
      />
    );
  }

  return (
    <>
      <TaskStoreProvider
        key={`${data.project.id}-${detail.loadSeq}-${data.open.length}`}
        api={httpTaskApi}
        clock={appClock}
        initialTasks={[...data.open, ...data.completed]}
        initialProjects={isNoProject ? [] : [data.project]}
        timeFormat={settings.timeFormat}
        // The app's one toast: it stays when the user moves to another tab
        onToast={showToast}
        // Completed sits right under the open list here: unticking a repeat shows where it goes
        mergeMotion
      >
        <ProjectContent
          project={data.project}
          initialProgress={data.progress}
          initialOpen={data.open}
          initialCompleted={data.completed}
          hasMoreCompleted={Boolean(data.next_cursor)}
          onLoadMoreCompleted={loadMoreCompleted}
          loadingMore={detail.loadingMore}
          today={today}
          timeFormat={settings.timeFormat}
          weekStart={settings.weekStart}
          allProjects={detail.allProjects}
          onBack={backToProjects}
          onRenameProject={isNoProject ? undefined : () => setRenaming(true)}
          onDeleteProject={isNoProject ? undefined : deleteThis}
          navigate={navigate}
        />
      </TaskStoreProvider>
      {renaming && (
        <ProjectSheet
          open
          project={data.project}
          projects={detail.allProjects}
          onClose={() => setRenaming(false)}
          clock={appClock}
          onUpdate={updateProject}
          onUpdated={(updated) => {
            detail.renamed(updated);
            notifyProjectsChanged();
            setRenaming(false);
          }}
        />
      )}
    </>
  );
}
