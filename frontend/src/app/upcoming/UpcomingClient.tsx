"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  PlusIcon,
  ScreenHeader,
  TaskPanel,
  TaskStoreProvider,
  UpcomingScreen,
  UpcomingViewSwitch,
  t,
  useTaskPanel,
  type UpcomingFilter,
  type UpcomingViewMode,
  RateLimited,
} from "@/ui";
import { LoadError } from "@/ui/components/LoadError";
import {
  readFilter,
  readViewMode,
  writeFilter,
  writeViewMode,
} from "@/ui/features/lists/storage";
import { httpTaskApi } from "@/lib/taskApi";
import { useAppFrame } from "../AppFrame";
import { appClock } from "../appClock";
import { useHeaderDate } from "../headerDate";
import { UpcomingSkeleton } from "../skeletons";
import { UpcomingFilterChips } from "./UpcomingFilterChips";
import { useUpcomingData } from "./useUpcomingData";

/** The filter and List or Board this device chose last; the board widens the page. */
function useUpcomingView() {
  const [filter, setFilter] = useState<UpcomingFilter>("all");
  const [viewMode, setViewMode] = useState<UpcomingViewMode>("list");

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setFilter(readFilter());
    setViewMode(readViewMode());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (viewMode === "board") root.dataset.boardView = "true";
    else delete root.dataset.boardView;
    return () => {
      delete root.dataset.boardView;
    };
  }, [viewMode]);

  const chooseFilter = (next: UpcomingFilter) => {
    setFilter(next);
    writeFilter(next);
  };
  const chooseViewMode = (next: UpcomingViewMode) => {
    setViewMode(next);
    writeViewMode(next);
  };
  return { filter, chooseFilter, viewMode, chooseViewMode };
}

/** Upcoming (LV-2): the coming days as a list or a board, with the task panel beside them. */
export function UpcomingClient() {
  const {
    navigate: rawNav,
    user,
    settings,
    openNewTask,
    showToast,
  } = useAppFrame();
  const { selectedTaskId, isWide, navigate, closePanel } = useTaskPanel(rawNav);
  const data = useUpcomingData();
  const { filter, chooseFilter, viewMode, chooseViewMode } = useUpcomingView();
  // Where the list was, so coming back from a task or New task lands there again
  const viewRef = useRef<{ anchor: string; day?: string } | null>(null);
  const date = useHeaderDate();
  const accountInitial = user?.display_name || user?.email || "";
  // Full width and the board put the controls in the header
  const isFull = settings.pageView === "full" || viewMode === "board";

  const headerControls = (
    <div className="flex items-center gap-3">
      {isFull && (
        <div className="hidden md:block">
          <UpcomingFilterChips
            value={filter}
            onChange={chooseFilter}
            size="md"
          />
        </div>
      )}
      {/* Pinned to the top-right corner of the page, level with the date (the AppShell column is relative) */}
      <UpcomingViewSwitch
        viewMode={viewMode}
        onChange={chooseViewMode}
        className="md:absolute md:top-[34px] md:right-10"
      />
      <Button
        variant="primary"
        pill
        className="hidden h-10 min-h-10 px-5 text-callout font-medium md:inline-flex"
        onClick={openNewTask}
      >
        <PlusIcon size={16} />
        {t("task.new")}
      </Button>
    </div>
  );

  return (
    <div className="pb-8">
      <ScreenHeader
        overline={date}
        title={t("nav.upcoming")}
        accountInitial={accountInitial}
        navigate={navigate}
        action={isFull ? headerControls : undefined}
      >
        {data.subtitle && (
          <p className="m-0 mt-1 text-footnote text-ink-secondary">
            {data.subtitle}
          </p>
        )}
        {isFull && (
          <div className="mt-4 md:hidden">
            <UpcomingFilterChips value={filter} onChange={chooseFilter} />
          </div>
        )}
      </ScreenHeader>

      {!isFull && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <UpcomingFilterChips
            value={filter}
            onChange={chooseFilter}
            size="md"
          />
          {headerControls}
        </div>
      )}

      {data.status === "loading" && (
        <UpcomingSkeleton board={viewMode === "board"} />
      )}
      {data.status === "error" && data.limited && (
        <RateLimited error={data.limited} onRetry={data.retry} />
      )}
      {data.status === "error" && !data.limited && (
        <LoadError message={data.errorMessage} onRetry={data.retry} />
      )}
      {data.status === "ready" && (
        <TaskStoreProvider
          key={data.loadSeq}
          api={httpTaskApi}
          clock={appClock}
          initialTasks={data.tasks}
          initialProjects={data.projectList}
          timeFormat={settings.timeFormat}
          // The app's one toast: it stays when the user moves to another tab
          onToast={showToast}
        >
          <UpcomingScreen
            accountInitial={accountInitial}
            navigate={navigate}
            showHeader={false}
            showFilter={false}
            filter={filter}
            onFilterChange={chooseFilter}
            viewMode={viewMode}
            onViewModeChange={chooseViewMode}
            selectedTaskId={selectedTaskId}
            weekStart={settings.weekStart}
            initialView={() => viewRef.current}
            onViewChange={(view) => {
              viewRef.current = { anchor: view.anchor, day: undefined };
            }}
            onAddTask={(day) => {
              viewRef.current = { anchor: day, day };
              openNewTask({ startDate: day });
            }}
            onNewTask={() => openNewTask()}
          />
          {isWide && selectedTaskId && (
            <TaskPanel
              variant={settings.pageView === "full" ? "aside" : "popup"}
              taskId={selectedTaskId}
              onClose={closePanel}
              projects={data.projectList}
              projectsStatus={data.projectsStatus}
              onRetryProjects={data.retryProjects}
              weekStart={settings.weekStart}
            />
          )}
        </TaskStoreProvider>
      )}
    </div>
  );
}
