"use client";

import { useEffect, useState, type ReactElement } from "react";
import { appClock } from "../../appClock";
import { useAppFrame } from "../../AppFrame";
import { ApiRequestError } from "../../../lib/apiError";
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

interface ClientProps {
  id: string;
}

function PageMessage({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}): ReactElement {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-body text-ink-secondary">{message}</p>
      <Button variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
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

export default function TaskDetailsClient({
  id,
}: ClientProps): ReactElement | null {
  const { back, navigate, settings } = useAppFrame();

  const [task, setTask] = useState<Task | null>(null);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [errorState, setErrorState] = useState<{
    notFound: boolean;
    message?: string;
  } | null>(null);
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
        const notFound =
          err instanceof Error && err.message === "error.not_found";
        if (notFound) {
          setErrorState({ notFound: true });
        } else if (err instanceof ApiRequestError) {
          setErrorState({
            notFound: false,
            message: t("error.generic", {
              request_id: err.requestId ?? err.code,
            }),
          });
        } else {
          setErrorState({
            notFound: false,
            message: t("app.offline"),
          });
        }
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
    setErrorState(null);
    setReloadKey((k) => k + 1);
  };

  if (loading) {
    if (!showSkeleton) return null;
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex animate-pulse flex-col gap-6 pb-8"
      >
        <div className="h-10 w-24 rounded bg-surface" />
        <div className="h-14 w-full rounded bg-surface" />
        <div className="h-32 w-full rounded bg-surface" />
        <div className="h-32 w-full rounded bg-surface" />
      </div>
    );
  }

  if (errorState?.notFound) {
    return (
      <PageMessage
        message={t("error.not_found")}
        actionLabel={t("common.back")}
        onAction={back}
      />
    );
  }

  if (errorState || !task) {
    return (
      <PageMessage
        message={errorState?.message ?? t("app.offline")}
        actionLabel={t("common.retry")}
        onAction={retry}
      />
    );
  }

  return (
    <TaskStoreProvider
      api={httpTaskApi}
      clock={appClock}
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
