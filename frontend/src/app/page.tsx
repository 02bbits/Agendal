"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Button,
  InboxScreen,
  PlusIcon,
  ScreenHeader,
  TaskStoreProvider,
  Toast,
  t,
  useTaskStore,
  type Clock,
  type Project,
  type Task,
} from "@/ui";
import { headerDate, subscribeHeaderDate } from "./headerDate";
import { useAppFrame } from "./AppFrame";
import { httpTaskApi, inbox, projects } from "@/lib/taskApi";
import { now, timeZone } from "@/lib/clock";

const clock: Clock = {
  now,
  get timeZone() {
    return timeZone();
  },
};

function InboxToast() {
  const { toast, dismissToast } = useTaskStore();
  return <Toast toast={toast} onDismiss={dismissToast} />;
}

export default function Page() {
  const { navigate, user, settings, openNewTask } = useAppFrame();
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksVersion, setTasksVersion] = useState<number>(0);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [subtitle, setSubtitle] = useState<string>("");

  const date = useSyncExternalStore(
    subscribeHeaderDate,
    () => headerDate(),
    () => undefined,
  );

  const accountInitial = user?.display_name || user?.email || "";

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
        setTasksVersion((v) => v + 1);
        const overdueCount = inboxData?.overdue?.length ?? 0;
        const todayCount = inboxData?.today?.length ?? 0;
        setSubtitle(
          t("list.inbox_subtitle", {
            overdue: overdueCount,
            today: todayCount,
          }),
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
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      window.removeEventListener("agendal:task-created", handleTaskCreated);
      window.removeEventListener(
        "agendal:projects-changed",
        handleProjectsChanged,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="pb-8">
      <ScreenHeader
        overline={date}
        title={t("nav.inbox")}
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
        <div data-testid="inbox-loading" className="flex justify-center py-12">
          <span className="loading loading-spinner text-ink-tertiary" />
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
          key={tasksVersion}
          api={httpTaskApi}
          clock={clock}
          initialTasks={tasks}
          initialProjects={projectList}
          timeFormat={settings.timeFormat}
        >
          <InboxScreen
            accountInitial={accountInitial}
            navigate={navigate}
            showHeader={false}
          />
          <InboxToast />
        </TaskStoreProvider>
      )}
    </div>
  );
}
