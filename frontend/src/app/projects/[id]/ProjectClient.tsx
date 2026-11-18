"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ProjectScreen,
  ProjectSheet,
  ROUTES,
  TaskPanel,
  TaskStoreProvider,
  Toast,
  t,
  useTaskPanel,
  useTaskStore,
  type Navigate,
  type Project,
  type Task,
  type TimeFormat,
  type WeekStart,
} from "@/ui";
import { useAppFrame } from "../../AppFrame";
import {
  deleteProject,
  getProject,
  listProjects,
  restoreProject,
  updateProject,
  type ProjectDetailResponse,
} from "@/lib/projectApi";
import { httpTaskApi } from "@/lib/taskApi";
import { useToday } from "@/ui/features/tasks/useToday";
import { appClock } from "../../appClock";
import { PageMessage } from "../../PageMessage";
import type { ProjectTaskAction } from "@/ui/features/projects/DeleteProjectDialog";
import { SYNCED } from "@/lib/sync";
import { ProjectSkeleton } from "../../skeletons";

export function ProjectClient({ id }: { id: string }) {
  const { navigate, showToast, settings } = useAppFrame();
  const isNoProject = id === "none";
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped on every load: Next keeps this page hidden while we're on a task
  // and loads again when we come back, so a new store key shows fresh rows
  const [loadSeq, setLoadSeq] = useState(0);
  // Every project, so the task panel can move a task to another one
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  const today = useToday(appClock);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((list) => {
        if (active) setAllProjects(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getProject(id)
      .then((res) => {
        if (!active) return;
        const project =
          res.project ??
          ({
            id: "none",
            name: t("project.none"),
            colour: "gray",
            open: res.progress.total - res.progress.done,
            done: res.progress.done,
          } as Project & { open: number; done: number });
        setData({
          ...res,
          project,
        });
        setNextCursor(res.next_cursor);
        setLoadSeq((n) => n + 1);
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
      const matches = isNoProject
        ? !created?.project_id || created?.project_id === "none"
        : created?.project_id === id;
      if (created && matches) {
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
    // Changes pulled by sync (IM-52)
    window.addEventListener(SYNCED, onTaskCreated);
    return () => {
      window.removeEventListener("agendal:task-created", onTaskCreated);
      window.removeEventListener(SYNCED, onTaskCreated);
    };
  }, [id, isNoProject]);

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

  // At once, no delay: the tap that opened this page already showed this same skeleton (#161)
  if (loading) return <ProjectSkeleton />;

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
        key={`${data.project.id}-${loadSeq}-${data.open.length}`}
        api={httpTaskApi}
        clock={appClock}
        initialTasks={[...data.open, ...data.completed]}
        initialProjects={isNoProject ? [] : [data.project]}
        timeFormat={settings.timeFormat}
      >
        <ProjectContent
          project={data.project}
          initialProgress={data.progress}
          initialOpen={data.open}
          initialCompleted={data.completed}
          hasMoreCompleted={Boolean(nextCursor)}
          onLoadMoreCompleted={handleLoadMoreCompleted}
          loadingMore={loadingMore}
          today={today}
          timeFormat={settings.timeFormat}
          weekStart={settings.weekStart}
          allProjects={allProjects}
          onBack={() => navigate(ROUTES.projects)}
          onRenameProject={isNoProject ? undefined : () => setRenaming(true)}
          onDeleteProject={isNoProject ? undefined : handleDelete}
          navigate={navigate}
        />
      </TaskStoreProvider>
      {renaming && (
        <ProjectSheet
          open
          project={data.project}
          projects={allProjects}
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
  initialProgress,
  initialOpen = [],
  initialCompleted = [],
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
  initialProgress?: { done: number; total: number };
  initialOpen?: Task[];
  initialCompleted?: Task[];
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
  const {
    selectedTaskId,
    isWide,
    navigate: handleNavigate,
    closePanel: handleClosePanel,
  } = useTaskPanel(navigate);

  const initialOpenIds = useMemo(
    () => new Set(initialOpen.map((t) => t.id)),
    [initialOpen],
  );
  const initialCompletedIds = useMemo(
    () => new Set(initialCompleted.map((t) => t.id)),
    [initialCompleted],
  );

  // A task moved to another project leaves this screen. A task just completed
  // stays in Open with its tick while it settles, like the Inbox (LV-1)
  const isNoProject = project.id === "none";
  const tasks = store.tasks.filter((t) =>
    isNoProject ? !t.project_id : t.project_id === project.id,
  );
  const openTasks = tasks.filter((t) => !t.done || store.isSettling(t.id));
  const completedTasks = tasks.filter((t) => t.done && !store.isSettling(t.id));

  const progress = useMemo(() => {
    if (!initialProgress) {
      return {
        done: completedTasks.length,
        total: openTasks.length + completedTasks.length,
      };
    }
    const openSet = initialOpenIds ?? new Set<string>();
    const completedSet = initialCompletedIds ?? new Set<string>();

    // Tasks that were initially open and are now completed (and not settling)
    const newlyDone = tasks.filter(
      (t) => openSet.has(t.id) && t.done && !store.isSettling(t.id),
    ).length;

    // Tasks that were initially completed and have been uncompleted (now open or settling)
    const newlyUndone = tasks.filter(
      (t) => completedSet.has(t.id) && (!t.done || store.isSettling(t.id)),
    ).length;

    // Newly created tasks in this project (not in openSet or completedSet) that are completed
    const createdDone = tasks.filter(
      (t) =>
        !openSet.has(t.id) &&
        !completedSet.has(t.id) &&
        t.done &&
        !store.isSettling(t.id),
    ).length;

    // Any initially completed tasks that were deleted from the store
    const currentTaskIds = new Set(tasks.map((t) => t.id));
    const deletedCompleted = Array.from(completedSet).filter(
      (id) => !currentTaskIds.has(id),
    ).length;

    const liveDone = Math.max(
      0,
      initialProgress.done +
        newlyDone +
        createdDone -
        newlyUndone -
        deletedCompleted,
    );
    const liveTotal = liveDone + openTasks.length;

    return {
      done: liveDone,
      total: liveTotal,
    };
  }, [
    initialProgress,
    initialOpenIds,
    initialCompletedIds,
    tasks,
    openTasks.length,
    completedTasks.length,
    store,
  ]);

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
        navigate={handleNavigate}
        selectedTaskId={selectedTaskId}
      />
      {isWide && selectedTaskId && (
        <TaskPanel
          variant={settings.pageView === "full" ? "aside" : "popup"}
          taskId={selectedTaskId}
          onClose={handleClosePanel}
          projects={allProjects.length > 0 ? allProjects : [project]}
          weekStart={weekStart}
        />
      )}
      {/* "Completed …" with Undo, like the Inbox */}
      <Toast toast={store.toast} onDismiss={store.dismissToast} />
    </>
  );
}
