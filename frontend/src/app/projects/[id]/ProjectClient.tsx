"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, ProjectScreen, ROUTES, t, type Task } from "@/ui";
import { useAppFrame } from "../../AppFrame";
import {
  deleteProject,
  getProject,
  restoreProject,
  type ProjectDetailResponse,
} from "@/lib/projectApi";
import { httpTaskApi } from "@/lib/taskApi";
import { useToday } from "@/ui/features/tasks/useToday";
import { appClock } from "../../appClock";
import { PageMessage } from "../../PageMessage";
import type { ProjectTaskAction } from "@/ui/features/projects/DeleteProjectDialog";

export function ProjectClient({ id }: { id: string }) {
  const { navigate, back, showToast, settings } = useAppFrame();
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const today = useToday(appClock);

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

  const handleToggleTask = async (task: Task) => {
    if (!data) return;
    const isComplete = !task.done;
    const at = appClock.now().toISOString();

    if (isComplete) {
      const updatedTask: Task = { ...task, done: true, done_at: at };
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          open: prev.open.map((t) => (t.id === task.id ? updatedTask : t)),
          progress: {
            done: prev.progress.done + 1,
            total: prev.progress.total,
          },
        };
      });

      const timer = setTimeout(() => {
        setData((prev) => {
          if (!prev) return prev;
          const openWithout = prev.open.filter((t) => t.id !== task.id);
          const alreadyInCompleted = prev.completed.some(
            (t) => t.id === task.id,
          );
          return {
            ...prev,
            open: openWithout,
            completed: alreadyInCompleted
              ? prev.completed
              : [updatedTask, ...prev.completed],
          };
        });
      }, 600);

      try {
        const res = await httpTaskApi.complete(task.id, at);
        if (
          res.next &&
          !res.next.done &&
          res.next.project_id === data.project.id
        ) {
          setData((prev) => {
            if (!prev) return prev;
            if (
              [...prev.open, ...prev.completed].some(
                (row) => row.id === res.next!.id,
              )
            )
              return prev;
            return {
              ...prev,
              open: [...prev.open, res.next!],
              progress: {
                done: prev.progress.done,
                total: prev.progress.total + 1,
              },
            };
          });
        }

        showToast({
          message: t("task.completed", { title: task.title }),
          icon: <CheckCircleIcon size={18} />,
          actionLabel: t("common.undo"),
          onAction: async () => {
            clearTimeout(timer);
            const reopenedAt = appClock.now().toISOString();
            const reopenedTask: Task = { ...task, done: false, done_at: null };
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                open: prev.open.some((t) => t.id === task.id)
                  ? prev.open.map((t) => (t.id === task.id ? reopenedTask : t))
                  : [...prev.open, reopenedTask],
                completed: prev.completed.filter((t) => t.id !== task.id),
                progress: {
                  done: Math.max(0, prev.progress.done - 1),
                  total: prev.progress.total,
                },
              };
            });
            try {
              await httpTaskApi.reopen(task.id, reopenedAt);
            } catch {
              showToast(t("error.save_failed"));
            }
          },
        });
      } catch {
        clearTimeout(timer);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            open: prev.open.map((t) => (t.id === task.id ? task : t)),
            completed: prev.completed.filter((t) => t.id !== task.id),
            progress: {
              done: Math.max(0, prev.progress.done - 1),
              total: prev.progress.total,
            },
          };
        });
        showToast(t("error.save_failed"));
      }
    } else {
      const reopenedTask: Task = { ...task, done: false, done_at: null };
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          completed: prev.completed.filter((t) => t.id !== task.id),
          open: [...prev.open, reopenedTask],
          progress: {
            done: Math.max(0, prev.progress.done - 1),
            total: prev.progress.total,
          },
        };
      });

      try {
        const res = await httpTaskApi.reopen(task.id, at);
        if (res.next) {
          setData((prev) => {
            if (!prev) return prev;
            const open = prev.open.filter((row) => row.id !== res.next!.id);
            const completed = prev.completed.filter(
              (row) => row.id !== res.next!.id,
            );
            const removed =
              prev.open.length +
              prev.completed.length -
              open.length -
              completed.length;
            return {
              ...prev,
              open,
              completed,
              progress: {
                ...prev.progress,
                total: prev.progress.total - removed,
              },
            };
          });
        }
      } catch {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            open: prev.open.filter((t) => t.id !== task.id),
            completed: [task, ...prev.completed],
            progress: {
              done: prev.progress.done + 1,
              total: prev.progress.total,
            },
          };
        });
        showToast(t("error.save_failed"));
      }
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
    return (
      <div className="p-8 text-center text-ink-secondary">
        {t("common.back")}...
      </div>
    );
  }

  if (error === 404 || !data) {
    return (
      <PageMessage
        message={t("error.not_found")}
        actionLabel={t("common.back")}
        onAction={back}
      />
    );
  }

  return (
    <ProjectScreen
      project={data.project}
      progress={data.progress}
      openTasks={data.open}
      completedTasks={data.completed}
      hasMoreCompleted={Boolean(nextCursor)}
      onLoadMoreCompleted={nextCursor ? handleLoadMoreCompleted : undefined}
      loadingMore={loadingMore}
      today={today}
      timeFormat={settings.timeFormat}
      onToggleTask={handleToggleTask}
      onBack={back}
      onDeleteProject={handleDelete}
      navigate={navigate}
    />
  );
}
