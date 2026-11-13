import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/apiError";
import { now, timeZone, today } from "@/lib/clock";
import { readProjects, readTasks } from "@/lib/localStore";
import { inbox, projects } from "@/lib/taskApi";
import { buildInbox, t, type Project, type Task } from "@/ui";

// Same counts as the server's, from the tasks on the device
function subtitleOf(tasks: readonly Task[]) {
  const view = buildInbox(tasks, today(timeZone(), now()), {
    completedToday: () => false,
  });
  return t("list.inbox_subtitle", {
    overdue: view.overdue.length,
    today: view.today.length,
  });
}

export function useInboxData() {
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<"ready" | "failed">(
    "ready",
  );
  const [subtitle, setSubtitle] = useState<string>("");
  const shownFromDevice = useRef(false);
  // The network answered at least once, so the device copy is no longer needed
  const fresh = useRef(false);

  const handleRetryProjects = () => {
    projects()
      .then((res) => {
        setProjectList(res ?? []);
        setProjectsStatus("ready");
      })
      .catch(() => setProjectsStatus("failed"));
  };

  const fetchData = () => {
    Promise.all([inbox(), projects()])
      .then(([inboxData, projectsData]) => {
        fresh.current = true;
        setTasks([
          ...(inboxData?.overdue ?? []),
          ...(inboxData?.today ?? []),
          ...(inboxData?.no_date ?? []),
          ...(inboxData?.completed_today ?? []),
        ]);
        setProjectList(projectsData ?? []);
        setProjectsStatus("ready");
        setSubtitle(
          t("list.inbox_subtitle", {
            overdue: inboxData?.overdue?.length ?? 0,
            today: inboxData?.today?.length ?? 0,
          }),
        );
        setStatus("ready");
      })
      .catch((err: unknown) => {
        // Offline with the device copy on screen: keep showing it, the banner says why
        if (!(err instanceof ApiRequestError) && shownFromDevice.current)
          return;
        if (err instanceof ApiRequestError) {
          setErrorMessage(
            t("error.generic", {
              request_id: err.requestId ?? "",
            }),
          );
        } else {
          setErrorMessage(t("error.generic"));
        }
        setStatus("error");
      });
  };

  const handleRetry = () => {
    setStatus("loading");
    fetchData();
  };

  useEffect(() => {
    // Lists read the device first (AP-2), then the network replaces it
    void Promise.all([readTasks(), readProjects()]).then(
      ([cached, cachedProjects]) => {
        if (
          fresh.current ||
          (cached.length === 0 && cachedProjects.length === 0)
        )
          return;
        shownFromDevice.current = true;
        setTasks(cached);
        setProjectList(cachedProjects);
        setSubtitle(subtitleOf(cached));
        setStatus("ready");
      },
    );
    fetchData();
    const refresh = () => fetchData();
    const onVis = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    window.addEventListener("agendal:task-created", refresh);
    window.addEventListener("agendal:projects-changed", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("agendal:task-created", refresh);
      window.removeEventListener("agendal:projects-changed", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return {
    status,
    errorMessage,
    tasks,
    projectList,
    projectsStatus,
    subtitle,
    handleRetry,
    handleRetryProjects,
  };
}
