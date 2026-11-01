"use client";

import { useEffect, useState } from "react";
import {
  Button,
  PlusIcon,
  ScreenHeader,
  TaskStoreProvider,
  Toast,
  UpcomingScreen,
  addDays,
  t,
  useTaskStore,
  type Clock,
  type Project,
  type Task,
} from "@/ui";
import { useAppFrame } from "../AppFrame";
import { httpTaskApi, projects, upcoming } from "@/lib/taskApi";
import { now, timeZone, today } from "@/lib/clock";

const clock: Clock = {
  now,
  get timeZone() {
    return timeZone();
  },
};

function UpcomingToast() {
  const { toast, dismissToast } = useTaskStore();
  return <Toast toast={toast} onDismiss={dismissToast} />;
}

export function UpcomingClient() {
  const { navigate, user, settings, openNewTask } = useAppFrame();
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [subtitle, setSubtitle] = useState<string>("");

  const accountInitial = user?.display_name || user?.email || "";

  const fetchData = () => {
    Promise.all([upcoming({ days: 365 }), projects()])
      .then(([upcomingData, projectsData]) => {
        const flatTasks = (upcomingData?.days ?? []).flatMap((d) => d.tasks);
        setTasks(flatTasks);
        setProjectList(projectsData ?? []);

        const todayStr = today(timeZone(), now());
        const limitDate = addDays(todayStr, 7);
        const next7DaysTasks = flatTasks.filter(
          (x) =>
            !x.done &&
            x.due_date &&
            x.due_date > todayStr &&
            x.due_date <= limitDate,
        );
        const count = next7DaysTasks.length;
        setSubtitle(
          count === 1
            ? t("list.upcoming_subtitle_one", { count: 1 })
            : t("list.upcoming_subtitle", { count }),
        );
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
      });
  };

  const handleRetry = () => {
    setStatus("loading");
    fetchData();
  };

  useEffect(() => {
    fetchData();

    const handleTaskCreated = () => {
      fetchData();
    };
    const handleProjectsChanged = () => {
      fetchData();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };

    window.addEventListener("agendal:task-created", handleTaskCreated);
    window.addEventListener("agendal:projects-changed", handleProjectsChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("agendal:task-created", handleTaskCreated);
      window.removeEventListener(
        "agendal:projects-changed",
        handleProjectsChanged,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="pb-8">
      <ScreenHeader
        overline=""
        title={t("nav.upcoming")}
        accountInitial={accountInitial}
        navigate={navigate}
        actions={
          <Button
            variant="primary"
            pill
            className="hidden px-5 py-2.5 text-callout font-medium md:inline-flex"
            onClick={openNewTask}
          >
            <PlusIcon size={16} />
            {t("task.new")}
          </Button>
        }
      >
        {subtitle && (
          <p className="m-0 mt-1 text-footnote text-ink-secondary">
            {subtitle}
          </p>
        )}
      </ScreenHeader>

      {status === "loading" && (
        <div className="space-y-4 py-4" data-testid="upcoming-loading">
          <div className="h-6 w-32 animate-pulse rounded-full bg-separator/40" />
          <div className="space-y-3 rounded-2xl border border-separator/40 bg-surface p-4 shadow-xs">
            <div className="h-5 w-48 animate-pulse rounded-full bg-separator/30" />
            <div className="h-5 w-64 animate-pulse rounded-full bg-separator/30" />
            <div className="h-5 w-40 animate-pulse rounded-full bg-separator/30" />
          </div>
          <div className="mt-6 h-6 w-32 animate-pulse rounded-full bg-separator/40" />
          <div className="space-y-3 rounded-2xl border border-separator/40 bg-surface p-4 shadow-xs">
            <div className="h-5 w-56 animate-pulse rounded-full bg-separator/30" />
            <div className="h-5 w-36 animate-pulse rounded-full bg-separator/30" />
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <p className="text-callout text-ink-secondary">
            {t("error.generic")}
          </p>
          <Button onClick={handleRetry}>{t("common.retry")}</Button>
        </div>
      )}
      {status === "ready" && (
        <TaskStoreProvider
          api={httpTaskApi}
          clock={clock}
          initialTasks={tasks}
          initialProjects={projectList}
          timeFormat={settings.timeFormat}
        >
          <UpcomingScreen
            accountInitial={accountInitial}
            navigate={navigate}
            showHeader={false}
          />
          <UpcomingToast />
        </TaskStoreProvider>
      )}
    </div>
  );
}
