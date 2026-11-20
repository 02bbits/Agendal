"use client";

import { Suspense } from "react";
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
} from "@/ui";
import { LoadError } from "@/ui/components/LoadError";
import { useHeaderDate } from "./headerDate";
import { useAppFrame } from "./AppFrame";
import { httpTaskApi } from "@/lib/taskApi";
import { appClock } from "./appClock";
import { useInboxData } from "./useInboxData";
import { InboxSkeleton } from "./skeletons";

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

  const date = useHeaderDate();
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
      {status === "loading" && <InboxSkeleton />}
      {status === "error" && (
        <LoadError message={errorMessage} onRetry={handleRetry} />
      )}
      {status === "ready" && (
        <TaskStoreProvider
          api={httpTaskApi}
          clock={appClock}
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
