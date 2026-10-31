"use client";

import { use, useEffect, useState, type ReactElement } from "react";
import { useAppFrame } from "../../AppFrame";
import { now, timeZone } from "../../../lib/clock";
import { getTask, httpTaskApi, projects } from "../../../lib/taskApi";
import {
  Button,
  TaskDetails,
  TaskStoreProvider,
  t,
  useTaskStore,
  type Project,
  type Task,
} from "../../../ui";
import type { Navigate } from "../../../ui/features/shell/routes";

export const SKELETON_DELAY_MS = 300;

const clock = {
  now,
  get timeZone() {
    return timeZone();
  },
};

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

function TaskDetailsContainer({
  initialTask,
  back,
  navigate,
}: {
  initialTask: Task;
  back: () => void;
  navigate?: Navigate;
}): ReactElement {
  const store = useTaskStore();
  const currentTask =
    store.tasks.find((t) => t.id === initialTask.id) ?? initialTask;
  return <TaskDetails task={currentTask} onBack={back} navigate={navigate} />;
}

export default function TaskDetailsPage({
  params,
}: PageProps): ReactElement | null {
  const id =
    typeof (params as { then?: unknown })?.then === "function"
      ? use(params as Promise<{ id: string }>).id
      : (params as { id: string }).id;
  const { back, navigate, settings } = useAppFrame();

  const [task, setTask] = useState<Task | null>(null);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [errorStatus, setErrorStatus] = useState<
    "not_found" | "generic" | null
  >(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getTask(id), projects().catch(() => [])])
      .then(([tData, pData]) => {
        if (cancelled) return;
        setTask(tData);
        setProjectList(pData);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        const isNotFound =
          (err instanceof Error && err.message === "error.not_found") ||
          (typeof err === "object" &&
            err !== null &&
            "status" in err &&
            (err as { status: unknown }).status === 404);
        setErrorStatus(isNotFound ? "not_found" : "generic");
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const retry = () => {
    setLoading(true);
    setShowSkeleton(false);
    setErrorStatus(null);
    setReloadKey((k) => k + 1);
  };

  if (loading) {
    if (!showSkeleton) return null;
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={t("error.slow")}
        className="flex animate-pulse flex-col gap-6 pb-8"
      >
        <div className="h-10 w-24 rounded bg-surface" />
        <div className="h-14 w-full rounded bg-surface" />
        <div className="h-32 w-full rounded bg-surface" />
        <div className="h-32 w-full rounded bg-surface" />
      </div>
    );
  }

  if (errorStatus === "not_found") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-body text-ink-secondary">{t("error.not_found")}</p>
        <Button variant="secondary" onClick={back}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  if (errorStatus === "generic" || !task) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-body text-ink-secondary">
          {t("error.generic", { request_id: "-" })}
        </p>
        <Button variant="secondary" onClick={retry}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <TaskStoreProvider
      api={httpTaskApi}
      clock={clock}
      initialTasks={[task]}
      initialProjects={projectList}
      timeFormat={settings.timeFormat}
    >
      <TaskDetailsContainer
        initialTask={task}
        back={back}
        navigate={navigate}
      />
    </TaskStoreProvider>
  );
}
