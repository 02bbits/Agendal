"use client";

import { useEffect, useState, type ReactElement } from "react";
import { appClock } from "../../appClock";
import { useAppFrame } from "../../AppFrame";
import { PageMessage } from "../../PageMessage";
import { ApiRequestError } from "../../../lib/apiError";
import { getTask, httpTaskApi, projects } from "../../../lib/taskApi";
import {
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

function getBackLabel(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fromParam = new URLSearchParams(window.location.search).get("from");
  if (fromParam === "inbox") return t("nav.inbox");
  if (fromParam === "upcoming") return t("nav.upcoming");
  if (fromParam === "projects") return t("nav.projects");

  if (document.referrer) {
    try {
      const url = new URL(document.referrer);
      if (url.origin === window.location.origin) {
        if (url.pathname === "/" || url.pathname === "") return t("nav.inbox");
        if (url.pathname.startsWith("/upcoming")) return t("nav.upcoming");
        if (url.pathname.startsWith("/projects")) return t("nav.projects");
      }
    } catch {
      // Ignore
    }
  }
  return undefined;
}

function TaskDetailsContainer({
  initialTask,
  back,
  navigate,
  projects,
  projectsStatus,
  onRetryProjects,
}: {
  initialTask: Task;
  back: () => void;
  navigate?: Navigate;
  projects: Project[];
  projectsStatus: "ready" | "failed";
  onRetryProjects: () => void;
}): ReactElement {
  const store = useTaskStore();

  const currentTask =
    store.tasks.find((t) => t.id === initialTask.id) ?? initialTask;
  return (
    <TaskDetails
      task={currentTask}
      onBack={back}
      navigate={navigate}
      projects={projects}
      projectsStatus={projectsStatus}
      onRetryProjects={onRetryProjects}
      variant="screen"
      backLabel={getBackLabel()}
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

  const reloadProjects = () => {
    return projects()
      .then((pData) => {
        setProjectsStatus("ready");
        setProjectList(pData);
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
        projects={projectList}
        projectsStatus={projectsStatus}
        onRetryProjects={reloadProjects}
      />
    </TaskStoreProvider>
  );
}
