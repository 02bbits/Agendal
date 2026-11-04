"use client";

import { Suspense, useSyncExternalStore } from "react";
import {
  Button,
  InboxScreen,
  PlusIcon,
  ScreenHeader,
  TaskPanel,
  TaskStoreProvider,
  Toast,
  t,
  useTaskPanel,
  useTaskStore,
  type Clock,
} from "@/ui";
import { headerDate, subscribeHeaderDate } from "./headerDate";
import { useAppFrame } from "./AppFrame";
import { httpTaskApi } from "@/lib/taskApi";
import { now, timeZone } from "@/lib/clock";
import { useInboxData } from "./useInboxData";

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
  return (
    <Suspense fallback={null}>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const { navigate: rawNav, user, settings, openNewTask } = useAppFrame();
  const { selectedTaskId, isWide, navigate, closePanel } = useTaskPanel(rawNav);
  const {
    status,
    errorMessage,
    tasks,
    projectList,
    projectsStatus,
    subtitle,
    handleRetry,
    handleRetryProjects,
  } = useInboxData();

  const date = useSyncExternalStore(
    subscribeHeaderDate,
    () => headerDate(),
    () => undefined,
  );
  const accountInitial = user?.display_name || user?.email || "";

  return (
    <div className="pb-8">
      <ScreenHeader
        overline={date}
        title={t("nav.inbox")}
        accountInitial={accountInitial}
        navigate={navigate}
        action={
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
            {errorMessage || t("error.generic")}
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
          <InboxScreen
            accountInitial={accountInitial}
            navigate={navigate}
            showHeader={false}
            selectedTaskId={selectedTaskId}
          />
          {isWide && selectedTaskId && (
            <TaskPanel
              taskId={selectedTaskId}
              onClose={closePanel}
              projects={projectList}
              projectsStatus={projectsStatus}
              onRetryProjects={handleRetryProjects}
              weekStart={settings.weekStart}
            />
          )}
          <InboxToast />
        </TaskStoreProvider>
      )}
    </div>
  );
}
