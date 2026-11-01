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
  const [error, setError] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const today = useToday(appClock);

  useEffect(() => {
    let active = true;
    getProject(id)
      .then((res) => {
        if (!active) return;
        setData(res);
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
        if (res.next && res.next.project_id === data.project.id) {
          setData((prev) => {
            if (!prev) return prev;
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
        await httpTaskApi.reopen(task.id, at);
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
      navigate(ROUTES.projects);
      showToast({
        message: t("project.deleted", { name: data.project.name }),
        actionLabel: t("common.undo"),
        onAction: async () => {
          try {
            await restoreProject(data.project.id, res.undo);
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
      today={today}
      timeFormat={settings.timeFormat}
      onToggleTask={handleToggleTask}
      onBack={back}
      onDeleteProject={handleDelete}
      navigate={navigate}
    />
  );
}
