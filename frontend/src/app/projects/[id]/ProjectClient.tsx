"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  ProjectScreen,
  ProjectSheet,
  ROUTES,
  t,
  type Task,
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
  const { navigate, back, showToast, settings } = useAppFrame();
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

  const settleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const togglingRef = useRef<Set<string>>(new Set());

  const syncProjectData = async () => {
    try {
      const res = await getProject(id);
      setData((prev) => {
        if (!prev) return res;
        const settlingIds = new Set(settleTimers.current.keys());
        const settlingOpenTasks = prev.open.filter((t) =>
          settlingIds.has(t.id),
        );
        const settlingOpenIds = new Set(settlingOpenTasks.map((t) => t.id));

        const serverOpen = res.open.filter((t) => !settlingOpenIds.has(t.id));
        const open = [...settlingOpenTasks, ...serverOpen];

        const resCompletedIds = new Set(res.completed.map((t) => t.id));
        const olderCompleted = prev.completed.filter(
          (t) =>
            !resCompletedIds.has(t.id) &&
            !settlingOpenIds.has(t.id) &&
            !open.some((o) => o.id === t.id),
        );
        const completed = [...res.completed, ...olderCompleted];

        return {
          ...res,
          open,
          completed,
          next_cursor: res.next_cursor,
        };
      });
      setNextCursor(res.next_cursor);
    } catch {
      // Ignore background sync errors
    }
  };

  useEffect(() => {
    const timers = settleTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

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
    if (togglingRef.current.has(task.id)) return;
    togglingRef.current.add(task.id);

    try {
      const isComplete = !task.done;
      const at = appClock.now().toISOString();

      // Cancel any active settle timer for this task
      const activeTimer = settleTimers.current.get(task.id);
      if (activeTimer) {
        clearTimeout(activeTimer);
        settleTimers.current.delete(task.id);
      }

      if (isComplete) {
        const updatedTask: Task = { ...task, done: true, done_at: at };
        setData((prev) => {
          if (!prev) return prev;
          const hasInOpen = prev.open.some((t) => t.id === task.id);
          return {
            ...prev,
            open: hasInOpen
              ? prev.open.map((t) => (t.id === task.id ? updatedTask : t))
              : [...prev.open, updatedTask],
            completed: prev.completed.filter((t) => t.id !== task.id),
            progress: {
              done: prev.progress.done + 1,
              total: prev.progress.total,
            },
          };
        });

        const timer = setTimeout(() => {
          settleTimers.current.delete(task.id);
          setData((prev) => {
            if (!prev) return prev;
            const currentInOpen = prev.open.find((t) => t.id === task.id);
            if (!currentInOpen || !currentInOpen.done) {
              return prev;
            }
            const openWithout = prev.open.filter((t) => t.id !== task.id);
            const alreadyInCompleted = prev.completed.some(
              (t) => t.id === task.id,
            );
            return {
              ...prev,
              open: openWithout,
              completed: alreadyInCompleted
                ? prev.completed.map((t) =>
                    t.id === task.id ? updatedTask : t,
                  )
                : [updatedTask, ...prev.completed],
            };
          });
          syncProjectData();
        }, 600);
        settleTimers.current.set(task.id, timer);

        try {
          const res = await httpTaskApi.complete(task.id, at);
          if (res.next && res.next.project_id === data.project.id) {
            setData((prev) => {
              if (!prev) return prev;
              if (prev.open.some((t) => t.id === res.next!.id)) return prev;
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
              const timerToCancel = settleTimers.current.get(task.id);
              if (timerToCancel) {
                clearTimeout(timerToCancel);
                settleTimers.current.delete(task.id);
              }
              const reopenedAt = appClock.now().toISOString();
              const reopenedTask: Task = {
                ...task,
                done: false,
                done_at: null,
              };
              setData((prev) => {
                if (!prev) return prev;
                const hasInOpen = prev.open.some((t) => t.id === task.id);
                return {
                  ...prev,
                  open: hasInOpen
                    ? prev.open.map((t) =>
                        t.id === task.id ? reopenedTask : t,
                      )
                    : [reopenedTask, ...prev.open],
                  completed: prev.completed.filter((t) => t.id !== task.id),
                  progress: {
                    done: Math.max(0, prev.progress.done - 1),
                    total: prev.progress.total,
                  },
                };
              });
              try {
                await httpTaskApi.reopen(task.id, reopenedAt);
                syncProjectData();
              } catch {
                showToast(t("error.save_failed"));
              }
            },
          });
        } catch {
          const timerToCancel = settleTimers.current.get(task.id);
          if (timerToCancel) {
            clearTimeout(timerToCancel);
            settleTimers.current.delete(task.id);
          }
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
          const hasInOpen = prev.open.some((t) => t.id === task.id);
          return {
            ...prev,
            completed: prev.completed.filter((t) => t.id !== task.id),
            open: hasInOpen
              ? prev.open.map((t) => (t.id === task.id ? reopenedTask : t))
              : [reopenedTask, ...prev.open],
            progress: {
              done: Math.max(0, prev.progress.done - 1),
              total: prev.progress.total,
            },
          };
        });

        try {
          await httpTaskApi.reopen(task.id, at);
          syncProjectData();
        } catch {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              open: prev.open.filter((t) => t.id !== task.id),
              completed: prev.completed.some((t) => t.id === task.id)
                ? prev.completed
                : [task, ...prev.completed],
              progress: {
                done: prev.progress.done + 1,
                total: prev.progress.total,
              },
            };
          });
          showToast(t("error.save_failed"));
        }
      }
    } finally {
      togglingRef.current.delete(task.id);
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
        onAction={back}
      />
    );
  }

  return (
    <>
      <ProjectScreen
        project={data.project}
        progress={data.progress}
        openTasks={data.open}
        completedTasks={data.completed}
        hasMoreCompleted={Boolean(nextCursor)}
        onLoadMoreCompleted={handleLoadMoreCompleted}
        loadingMore={loadingMore}
        today={today}
        timeFormat={settings.timeFormat}
        onToggleTask={handleToggleTask}
        onBack={back}
        onRenameProject={() => setRenaming(true)}
        onDeleteProject={handleDelete}
        navigate={navigate}
      />
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
