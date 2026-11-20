"use client";

import { Suspense, useSyncExternalStore } from "react";
import {
  Button,
  InboxScreen,
  PlusIcon,
  ScreenHeader,
  TASK_COLUMN_CLASS,
  TaskPanel,
  TaskStoreProvider,
  Toast,
  cx,
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
        <div
          data-testid="inbox-loading"
          className={cx("flex flex-col gap-6 animate-pulse", TASK_COLUMN_CLASS)}
        >
          {/* Progress summary card skeleton */}
          <div className="flex items-center gap-4.5 rounded-2xl border border-separator/50 bg-surface p-4.5 shadow-xs">
            <div className="size-14 shrink-0 rounded-full bg-fill/80" />
            <div className="flex flex-col gap-2">
              <div className="h-5 w-36 rounded-xl bg-fill/80" />
              <div className="h-3.5 w-48 rounded-lg bg-fill/60" />
            </div>
          </div>

          {/* Section 1: Today skeleton */}
          <div>
            <div className="mb-2.5 mt-2 h-5 w-24 rounded-lg bg-fill/70" />
            <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
                >
                  <div className="size-5 shrink-0 rounded-full bg-fill/80" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div
                      className="h-4 rounded-xl bg-fill/80"
                      style={{
                        width: i === 1 ? "55%" : i === 2 ? "70%" : "40%",
                      }}
                    />
                    <div className="h-3 w-28 rounded-lg bg-fill/60" />
                  </div>
                  <div className="ml-auto h-4 w-12 shrink-0 rounded-full bg-fill/50" />
                </div>
              ))}
            </div>
          </div>
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
              variant={settings.pageView === "full" ? "aside" : "popup"}
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
