"use client";

import { useEffect, useState } from "react";
import {
  Button,
  CalendarIcon,
  ChipGroup,
  ClockIcon,
  PlusIcon,
  ScreenHeader,
  TaskPanel,
  TaskStoreProvider,
  Toast,
  UpcomingScreen,
  UpcomingViewSwitch,
  addDays,
  t,
  useTaskPanel,
  useTaskStore,
  type Clock,
  type Project,
  type Task,
  type UpcomingFilter,
  type UpcomingViewMode,
} from "@/ui";
import { useAppFrame } from "../AppFrame";
import { httpTaskApi, inbox, projects, upcoming } from "@/lib/taskApi";
import { now, timeZone, today } from "@/lib/clock";
import { ApiRequestError } from "@/lib/apiError";
import { headerDate, subscribeHeaderDate } from "../headerDate";
import { useSyncExternalStore } from "react";

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
  const { navigate: rawNav, user, settings, openNewTask } = useAppFrame();
  const { selectedTaskId, isWide, navigate, closePanel } = useTaskPanel(rawNav);
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  // Bumped on every load: Next keeps this page mounted but hidden after we
  // leave (cacheComponents), and the load runs again when we come back; a new
  // store key makes fresh tasks replace the store's old copy
  const [loadSeq, setLoadSeq] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<"ready" | "failed">(
    "ready",
  );
  const [subtitle, setSubtitle] = useState<string>("");
  const [filter, setFilter] = useState<UpcomingFilter>("all");
  const [viewMode, setViewMode] = useState<UpcomingViewMode>("list");

  useEffect(() => {
    try {
      const savedFilter = localStorage.getItem("agendal.upcoming.filter");
      if (savedFilter === "scheduled" || savedFilter === "due") {
        /* eslint-disable-next-line react-hooks/set-state-in-effect */
        setFilter(savedFilter);
      }
      const savedMode = localStorage.getItem("agendal.upcoming.view_mode");
      if (savedMode === "board" || savedMode === "grid") {
        setViewMode("board");
      }
    } catch {}
  }, []);

  const date = useSyncExternalStore(
    subscribeHeaderDate,
    () => headerDate(),
    () => "",
  );

  const accountInitial = user?.display_name || user?.email || "";

  const handleFilterChange = (next: UpcomingFilter) => {
    setFilter(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("agendal.upcoming.filter", next);
      } catch {}
    }
  };

  const handleViewModeChange = (next: UpcomingViewMode) => {
    setViewMode(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("agendal.upcoming.view_mode", next);
      } catch {}
    }
  };

  const handleRetryProjects = () => {
    projects()
      .then((pData) => {
        setProjectList(pData ?? []);
        setProjectsStatus("ready");
      })
      .catch(() => {
        setProjectsStatus("failed");
      });
  };

  const fetchData = () => {
    const todayStr = today(timeZone(), now());
    Promise.all([upcoming({ days: 366 }), inbox(), projects()])
      .then(([upcomingData, inboxData, projectsData]) => {
        const flatUpcoming = (upcomingData?.days ?? []).flatMap((d) => d.tasks);
        const overdueTasks = inboxData?.overdue ?? [];
        const seen = new Set<string>();
        const combinedTasks: Task[] = [];
        for (const t of [...overdueTasks, ...flatUpcoming]) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            combinedTasks.push(t);
          }
        }
        setTasks(combinedTasks);
        setProjectList(projectsData ?? []);
        setProjectsStatus("ready");

        const limitDate = addDays(todayStr, 7);
        const next7DaysTasks = flatUpcoming.filter(
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
        setLoadSeq((n) => n + 1);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError) {
          setErrorMessage(
            t("error.generic", {
              request_id: err.requestId ?? err.code,
            }),
          );
        } else {
          setErrorMessage(t("app.offline"));
        }
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
        overline={date}
        title={t("nav.upcoming")}
        accountInitial={accountInitial}
        navigate={navigate}
        action={
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ChipGroup
                label={t("list.filter_label")}
                value={filter}
                onChange={(next) => handleFilterChange(next as UpcomingFilter)}
                size="md"
                options={[
                  { value: "all", label: t("list.filter_all") },
                  {
                    value: "scheduled",
                    label: t("list.filter_scheduled"),
                    icon: <ClockIcon size={16} />,
                  },
                  {
                    value: "due",
                    label: t("list.filter_due"),
                    icon: <CalendarIcon size={16} />,
                  },
                ]}
              />
            </div>
            <UpcomingViewSwitch
              viewMode={viewMode}
              onChange={handleViewModeChange}
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
        }
      >
        {subtitle && (
          <p className="m-0 mt-1 text-footnote text-ink-secondary">
            {subtitle}
          </p>
        )}
        <div className="mt-4 md:hidden">
          <ChipGroup
            label={t("list.filter_label")}
            value={filter}
            onChange={(next) => handleFilterChange(next as UpcomingFilter)}
            options={[
              { value: "all", label: t("list.filter_all") },
              {
                value: "scheduled",
                label: t("list.filter_scheduled"),
                icon: <ClockIcon size={14} />,
              },
              {
                value: "due",
                label: t("list.filter_due"),
                icon: <CalendarIcon size={14} />,
              },
            ]}
          />
        </div>
      </ScreenHeader>

      {status === "loading" && (
        <div
          className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2 lg:grid-cols-4"
          data-testid="upcoming-loading"
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-28 animate-pulse rounded-full bg-separator/40" />
              <div className="space-y-3 rounded-2xl border border-separator/40 bg-surface p-4 shadow-xs">
                <div className="h-5 w-3/4 animate-pulse rounded-full bg-separator/30" />
                <div className="h-5 w-1/2 animate-pulse rounded-full bg-separator/30" />
              </div>
            </div>
          ))}
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <p className="text-callout text-ink-secondary">{errorMessage}</p>
          <Button onClick={handleRetry}>{t("common.retry")}</Button>
        </div>
      )}
      {status === "ready" && (
        <TaskStoreProvider
          key={loadSeq}
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
            showFilter={false}
            filter={filter}
            onFilterChange={handleFilterChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            selectedTaskId={selectedTaskId}
            weekStart={settings.weekStart}
            onAddTask={(date) => openNewTask({ dueDate: date })}
            onNewTask={() => openNewTask()}
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
          <UpcomingToast />
        </TaskStoreProvider>
      )}
    </div>
  );
}
