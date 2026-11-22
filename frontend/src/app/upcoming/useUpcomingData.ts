"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  countText,
  entriesOf,
  t,
  type Project,
  type Task,
} from "@/ui";
import { ApiRequestError } from "@/lib/apiError";
import { now, timeZone, today } from "@/lib/clock";
import { readProjects, readTasks } from "@/lib/localStore";
import { useDataChanged } from "../useDataChanged";
import { inbox, projects, upcoming } from "@/lib/taskApi";

/** Upcoming asks for a year ahead: the week strip and board can go that far. */
const DAYS_AHEAD = 366;
/** The subtitle counts the next week. */
const SUBTITLE_DAYS = 7;

/** "N tasks in the next 7 days": open tasks with a start or due day from tomorrow to a week out. */
function subtitleOf(tasks: readonly Task[]) {
  const todayStr = today(timeZone(), now());
  const limit = addDays(todayStr, SUBTITLE_DAYS);
  const count = tasks.filter(
    (task) =>
      !task.done &&
      entriesOf(task).some((e) => e.date > todayStr && e.date <= limit),
  ).length;
  return count === 1
    ? t("list.upcoming_subtitle_one", { count: 1 })
    : t("list.upcoming_subtitle", { count: countText(count, "no") });
}

/** Overdue first, then the coming days, each task once. */
function withoutRepeats(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((task) => !seen.has(task.id) && seen.add(task.id));
}

/**
 * Upcoming's tasks and projects: the device copy at once (AP-2), then the server's, again after a
 * task or project changes, a sync, or the app coming back. Offline with the device copy on screen,
 * a failed fetch keeps it and the banner says why.
 */
export function useUpcomingData() {
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  // Bumped on every load: Next keeps this page mounted but hidden after we leave
  // (cacheComponents), and the load runs again when we come back; a new store key makes fresh
  // tasks replace the store's old copy
  const [loadSeq, setLoadSeq] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<"ready" | "failed">(
    "ready",
  );
  const [subtitle, setSubtitle] = useState("");
  // Set once the network answers; until then the device copy may show (AP-2)
  const fresh = useRef(false);
  const shownFromDevice = useRef(false);

  const show = (next: Task[], nextProjects: Project[], counted: Task[]) => {
    setTasks(next);
    setProjectList(nextProjects);
    setSubtitle(subtitleOf(counted));
    setLoadSeq((n) => n + 1);
    setStatus("ready");
  };

  const fetchData = () => {
    Promise.all([upcoming({ days: DAYS_AHEAD }), inbox(), projects()])
      .then(([upcomingData, inboxData, projectsData]) => {
        fresh.current = true;
        const coming = (upcomingData?.days ?? []).flatMap((d) => d.tasks);
        setProjectsStatus("ready");
        show(
          withoutRepeats([...(inboxData?.overdue ?? []), ...coming]),
          projectsData ?? [],
          coming,
        );
      })
      .catch((err: unknown) => {
        const apiError = err instanceof ApiRequestError;
        if (!apiError && shownFromDevice.current) return;
        setErrorMessage(
          apiError
            ? t("error.generic", { request_id: err.requestId ?? err.code })
            : t("app.offline"),
        );
        setStatus("error");
      });
  };

  useEffect(() => {
    void Promise.all([readTasks(), readProjects()]).then(
      ([cached, cachedProjects]) => {
        if (
          fresh.current ||
          (cached.length === 0 && cachedProjects.length === 0)
        )
          return;
        const dated = cached.filter((task) => task.start_date || task.due_date);
        shownFromDevice.current = true;
        show(dated, cachedProjects, dated);
      },
    );
    fetchData();
    // Once on mount: later loads come from useDataChanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useDataChanged(fetchData);

  const retry = () => {
    setStatus("loading");
    fetchData();
  };

  const retryProjects = () => {
    projects()
      .then((list) => {
        setProjectList(list ?? []);
        setProjectsStatus("ready");
      })
      .catch(() => setProjectsStatus("failed"));
  };

  return {
    status,
    errorMessage,
    loadSeq,
    tasks,
    projectList,
    projectsStatus,
    subtitle,
    retry,
    retryProjects,
  };
}
