"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Button,
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

const clock: Clock = {
  now,
  get timeZone() {
    return timeZone();
  },
};

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
        setTasks([
          ...(inboxData?.overdue ?? []),
          ...(inboxData?.today ?? []),
          ...(inboxData?.no_date ?? []),
          ...(inboxData?.completed_today ?? []),
        ]);
        setProjectList(projectsData ?? []);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
      });
  };

  useEffect(() => {
    loadData();
  }, []);

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
          <Button onClick={loadData}>{t("common.retry")}</Button>
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
