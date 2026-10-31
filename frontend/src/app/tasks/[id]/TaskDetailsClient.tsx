"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
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
  projectsStatus,
  onRetryProjects,
  onRegisterStore,
}: {
  initialTask: Task;
  back: () => void;
  navigate?: Navigate;
  projectsStatus: "ready" | "failed";
  onRetryProjects: () => void;
  onRegisterStore: (
    setter: (updater: (prev: Project[]) => Project[]) => void,
  ) => void;
}): ReactElement {
  const store = useTaskStore();

  useEffect(() => {
    onRegisterStore(store.setProjects);
  }, [store.setProjects, onRegisterStore]);

  const currentTask =
    store.tasks.find((t) => t.id === initialTask.id) ?? initialTask;
  return (
    <TaskDetails
      task={currentTask}
      onBack={back}
      navigate={navigate}
      projectsStatus={projectsStatus}
      onRetryProjects={onRetryProjects}
    />
  );
}

export default function TaskDetailsClient({
  id,
}: ClientProps): ReactElement | null {
  const { back, navigate, settings } = useAppFrame();

  const [task, setTask] = useState<Task | null>(null);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<"ready" | "failed">(
    "ready",
  );
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [errorState, setErrorState] = useState<{
    notFound: boolean;
    message?: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const storeProjectsRef = useRef<
    ((updater: (prev: Project[]) => Project[]) => void) | null
  >(null);

  const reloadProjects = () => {
    return projects()
      .then((pData) => {
        setProjectsStatus("ready");
        storeProjectsRef.current?.(() => pData);
      })
      .catch(() => {
        setProjectsStatus("failed");
      });
  };

  useEffect(() => {
    let cancelled = false;

    const taskPromise = getTask(id);
    const projectsPromise = projects()
      .then((pData) => ({ status: "ready" as const, data: pData }))
      .catch(() => ({ status: "failed" as const, data: [] as Project[] }));

    Promise.all([taskPromise, projectsPromise])
      .then(([tData, pRes]) => {
        if (cancelled) return;
        setTask(tData);
        setProjectList(pRes.data);
        setProjectsStatus(pRes.status);
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
        projectsStatus={projectsStatus}
        onRetryProjects={reloadProjects}
        onRegisterStore={(setter) => {
          storeProjectsRef.current = setter;
        }}
      />
    </TaskStoreProvider>
  );
}
