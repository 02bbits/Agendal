"use client";

import { useEffect, useState } from "react";
import {
  ProjectScreen,
  ProjectSheet,
  ROUTES,
  TaskPanel,
  TaskStoreProvider,
  t,
  useTaskPanel,
  useTaskStore,
  type Navigate,
  type Project,
  type Task,
  type TimeFormat,
} from "@/ui";
import { useAppFrame } from "../../AppFrame";
import {
  deleteProject,
  getProject,
  restoreProject,
  updateProject,
  type ProjectDetailResponse,
} from "@/lib/projectApi";
import { httpTaskApi } from "@/lib/taskApi";
import { useToday } from "@/ui/features/tasks/useToday";
import { appClock } from "../../appClock";
import { PageMessage } from "../../PageMessage";
import type { ProjectTaskAction } from "@/ui/features/projects/DeleteProjectDialog";

export const SKELETON_DELAY_MS = 300;

export function ProjectClient({ id }: { id: string }) {
  const { navigate, showToast, settings } = useAppFrame();
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const today = useToday(appClock);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let active = true;
    getProject(id)
      .then((res) => {
        if (!active) return;
        setData(res);
        setNextCursor(res.next_cursor);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoading(false);
        setError(err?.status ?? 500);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const onTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const created = customEvent.detail;
      if (created && created.project_id === id) {
        setData((prev) => {
          if (!prev) return prev;
          if (prev.open.some((t) => t.id === created.id)) return prev;
          return {
            ...prev,
            open: [...prev.open, created],
            progress: {
              done: prev.progress.done,
              total: prev.progress.total + 1,
            },
          };
        });
      }
    };
    window.addEventListener("agendal:task-created", onTaskCreated);
    return () => {
      window.removeEventListener("agendal:task-created", onTaskCreated);
    };
  }, [id]);

  const handleLoadMoreCompleted = async () => {
    if (!nextCursor || loadingMore || !data) return;
    setLoadingMore(true);
    try {
      const res = await getProject(id, nextCursor);
      setData((prev) => {
        if (!prev) return prev;
        const existingIds = new Set(prev.completed.map((t) => t.id));
        const newCompleted = res.completed.filter(
          (t) => !existingIds.has(t.id),
        );
        return {
          ...prev,
          completed: [...prev.completed, ...newCompleted],
          next_cursor: res.next_cursor,
        };
      });
      setNextCursor(res.next_cursor);
    } catch {
      showToast(t("error.save_failed"));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (action: ProjectTaskAction) => {
    if (!data) return;
    try {
      const res = await deleteProject(data.project.id, action);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
      }
      navigate(ROUTES.projects);
      showToast({
        message: t("project.deleted", { name: data.project.name }),
        actionLabel: t("common.undo"),
        onAction: async () => {
          try {
            await restoreProject(data.project.id, res.undo);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
            }
            showToast(
              t("project.progress", {
                done: data.progress.done,
                total: data.progress.total,
              }),
            );
          } catch {
            showToast(t("error.save_failed"));
          }
        },
      });
    } catch {
      showToast(t("error.save_failed"));
    }
  };

  if (loading) {
    if (!showSkeleton) return null;
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex animate-pulse flex-col gap-4 pb-8"
      >
        <div className="flex items-center justify-between py-2">
          <div className="h-8 w-20 rounded-full bg-surface-hover/60" />
        </div>
        <div className="mt-2 mb-3 flex items-center gap-3">
          <div className="size-3 shrink-0 rounded-full bg-surface-hover/60" />
          <div className="h-7 w-48 rounded-xl bg-surface-hover/60" />
        </div>
        <div className="mb-6 flex flex-col gap-2">
          <div className="h-1.5 w-full rounded-full bg-fill/80" />
          <div className="h-3.5 w-28 rounded-lg bg-fill/60" />
        </div>
        <div className="rounded-2xl border border-separator/50 bg-surface shadow-xs overflow-hidden">
          <div className="flex flex-col">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
              >
                <div className="size-5 shrink-0 rounded-full bg-fill/80" />
                <div
                  className="h-4 rounded-xl bg-fill/80"
                  style={{ width: i === 1 ? "55%" : i === 2 ? "70%" : "40%" }}
                />
                <div className="ml-auto h-4 w-16 shrink-0 rounded-full bg-fill/60" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error === 404 || !data) {
    return (
      <PageMessage
        message={t("error.not_found")}
        actionLabel={t("common.back")}
        onAction={() => navigate(ROUTES.projects)}
      />
    );
  }

  return (
    <>
      <TaskStoreProvider
        key={`${data.project.id}-${data.open.length}`}
        api={httpTaskApi}
        clock={appClock}
        initialTasks={[...data.open, ...data.completed]}
        initialProjects={[data.project]}
        timeFormat={settings.timeFormat}
      >
        <ProjectContent
          project={data.project}
          hasMoreCompleted={Boolean(nextCursor)}
          onLoadMoreCompleted={handleLoadMoreCompleted}
          loadingMore={loadingMore}
          today={today}
          timeFormat={settings.timeFormat}
          onBack={() => navigate(ROUTES.projects)}
          onRenameProject={() => setRenaming(true)}
          onDeleteProject={handleDelete}
          navigate={navigate}
        />
      </TaskStoreProvider>
      {renaming && (
        <ProjectSheet
          open
          project={data.project}
          onClose={() => setRenaming(false)}
          clock={appClock}
          onUpdate={updateProject}
          onUpdated={(updated) => {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    project: {
                      ...prev.project,
                      name: updated.name,
                      colour: updated.colour,
                    },
                  }
                : prev,
            );
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
            }
            setRenaming(false);
          }}
        />
      )}
    </>
  );
}

function ProjectContent({
  project,
  hasMoreCompleted,
  onLoadMoreCompleted,
  loadingMore,
  today,
  timeFormat,
  onBack,
  onRenameProject,
  onDeleteProject,
  navigate,
}: {
  project: Project;
  hasMoreCompleted: boolean;
  onLoadMoreCompleted: () => Promise<void>;
  loadingMore: boolean;
  today: string;
  timeFormat: TimeFormat;
  onBack: () => void;
  onRenameProject: () => void;
  onDeleteProject: (action: ProjectTaskAction) => Promise<void>;
  navigate: Navigate;
}) {
  const store = useTaskStore();
  const {
    selectedTaskId,
    isWide,
    navigate: handleNavigate,
    closePanel: handleClosePanel,
  } = useTaskPanel(navigate);

  const openTasks = store.tasks.filter((t) => !t.done);
  const completedTasks = store.tasks.filter((t) => t.done);

  return (
    <>
      <ProjectScreen
        project={project}
        progress={{
          done: completedTasks.length,
          total: openTasks.length + completedTasks.length,
        }}
        openTasks={openTasks}
        completedTasks={completedTasks}
        hasMoreCompleted={hasMoreCompleted}
        onLoadMoreCompleted={onLoadMoreCompleted}
        loadingMore={loadingMore}
        today={today}
        timeFormat={timeFormat}
        onToggleTask={(task) => store.toggle(task)}
        onBack={onBack}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
        navigate={handleNavigate}
        selectedTaskId={selectedTaskId}
      />
      {isWide && selectedTaskId && (
        <TaskPanel
          taskId={selectedTaskId}
          onClose={handleClosePanel}
          projects={[project]}
        />
      )}
    </>
  );
}
