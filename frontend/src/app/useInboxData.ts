import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/apiError";
import { inbox, projects } from "@/lib/taskApi";
import { t, type Project, type Task } from "@/ui";

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
