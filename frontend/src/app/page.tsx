"use client";

import { Suspense } from "react";
import {
  Button,
  InboxScreen,
  PlusIcon,
  RateLimited,
  ScreenHeader,
  SortMenu,
  TaskPanel,
  TaskStoreProvider,
  t,
  useSortMode,
  useTaskPanel,
  type SortMode,
} from "@/ui";
import { LoadError } from "@/ui/components/LoadError";
import { useHeaderDate } from "./headerDate";
import { useAppFrame } from "./AppFrame";
import { httpTaskApi } from "@/lib/taskApi";
import { appClock } from "./appClock";
import { useInboxData } from "./useInboxData";
import { InboxSkeleton } from "./skeletons";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const {
    navigate: rawNav,
    user,
    settings,
    openNewTask,
    showToast,
  } = useAppFrame();
  const { selectedTaskId, isWide, navigate, closePanel } = useTaskPanel(rawNav);
  const {
    status,
    errorMessage,
    limited,
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
        action={<InboxHeaderAction openNewTask={openNewTask} />}
      >
        {subtitle && (
          <p className="m-0 mt-1 text-footnote text-ink-secondary">
            {subtitle}
          </p>
        )}
      </ScreenHeader>
      {status === "loading" && <InboxSkeleton />}
      {status === "error" && limited && (
        <RateLimited error={limited} onRetry={handleRetry} />
      )}
      {status === "error" && !limited && (
        <LoadError message={errorMessage} onRetry={handleRetry} />
      )}
      {status === "ready" && (
        <TaskStoreProvider
          api={httpTaskApi}
          clock={appClock}
          initialTasks={tasks}
          initialProjects={projectList}
          timeFormat={settings.timeFormat}
          // The app's one toast: it stays when the user moves to another tab
          onToast={showToast}
        >
          <InboxScreen
            accountInitial={accountInitial}
            navigate={navigate}
            showHeader={false}
            onNewTask={openNewTask}
            subtitle={subtitle}
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
        </TaskStoreProvider>
      )}
    </div>
  );
}

function InboxHeaderAction({
  openNewTask,
}: {
  openNewTask?: () => void;
}) {
  const [todayMode, setTodayMode] = useSortMode("today");
  const [, setNoDateMode] = useSortMode("no_date");
  const setInboxMode = (next: SortMode) => {
    setTodayMode(next);
    setNoDateMode(next);
  };
  const onSortByRules = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agendal:sort-inbox-rules"));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <SortMenu
        mode={todayMode}
        onModeChange={setInboxMode}
        listName={t("nav.inbox")}
        onSortByRules={onSortByRules}
      />
      {openNewTask && (
        <Button
          variant="primary"
          pill
          className="hidden px-5 py-2.5 text-callout font-medium md:inline-flex"
          onClick={openNewTask}
        >
          <PlusIcon size={16} />
          {t("task.new")}
        </Button>
      )}
    </div>
  );
}
