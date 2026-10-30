"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  InboxScreen,
  ScreenHeader,
  TaskStoreProvider,
  t,
  type Clock,
  type Project,
  type Task,
} from "@/ui";
import { headerDate } from "./headerDate";
import { useAppFrame } from "./AppFrame";
import { httpTaskApi, inbox, projects } from "@/lib/taskApi";
import { now, timeZone } from "@/lib/clock";

const noSubscription = () => () => {};

export default function Page() {
  const { navigate, user, settings } = useAppFrame();
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);

  const date = useSyncExternalStore(
    noSubscription,
    () => headerDate(),
    () => undefined,
  );

  const accountInitial = user?.display_name || user?.email || "";

  const loadData = () => {
    setStatus("loading");
    Promise.all([inbox(), projects()])
      .then(([inboxData, projectsData]) => {
        const combinedTasks: Task[] = [
          ...(Array.isArray(inboxData?.overdue) ? inboxData.overdue : []),
          ...(Array.isArray(inboxData?.today) ? inboxData.today : []),
          ...(Array.isArray(inboxData?.no_date) ? inboxData.no_date : []),
          ...(Array.isArray(inboxData?.completed_today)
            ? inboxData.completed_today
            : []),
        ];
        setTasks(combinedTasks);
        setProjectList(Array.isArray(projectsData) ? projectsData : []);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const clock: Clock = {
    now,
    get timeZone() {
      return timeZone();
    },
  };

  return (
    <div className="pb-8">
      <ScreenHeader
        overline={date}
        title={t("nav.inbox")}
        accountInitial={accountInitial}
        navigate={navigate}
      />
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
          <button
            type="button"
            onClick={loadData}
            className="focus-ring cursor-pointer rounded-tile bg-surface px-4 py-2 text-callout font-semibold text-primary"
          >
            {t("common.retry")}
          </button>
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
          <InboxScreen
            accountInitial={accountInitial}
            navigate={navigate}
            showHeader={false}
          />
        </TaskStoreProvider>
      )}
    </div>
  );
}
