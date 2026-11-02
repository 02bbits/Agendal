"use client";

import { useEffect, useState } from "react";
import {
  Button,
  CalendarIcon,
  ChipGroup,
  ClockIcon,
  GridIcon,
  ListIcon,
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
  type UpcomingFilter,
  type UpcomingViewMode,
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
  const [filter, setFilter] = useState<UpcomingFilter>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("agendal.upcoming.filter");
        return saved === "scheduled" || saved === "due" ? saved : "all";
      } catch {}
    }
    return "all";
  });
  const [viewMode, setViewMode] = useState<UpcomingViewMode>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("agendal.upcoming.view_mode");
        return saved === "list" ? "list" : "grid";
      } catch {}
    }
    return "grid";
  });

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
            <div
              role="group"
              aria-label="Chế độ xem"
              className="hidden h-10 items-center rounded-full border border-separator/60 bg-surface p-1 shadow-2xs md:inline-flex"
            >
              <button
                type="button"
                onClick={() => handleViewModeChange("grid")}
                className={`focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 text-footnote font-medium transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-content"
                    : "bg-transparent text-ink-secondary hover:bg-surface-hover/50 hover:text-ink"
                }`}
                aria-pressed={viewMode === "grid"}
                title="Chế độ ngang (Lưới)"
              >
                <GridIcon size={14} />
                <span>Ngang</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("list")}
                className={`focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 text-footnote font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-content"
                    : "bg-transparent text-ink-secondary hover:bg-surface-hover/50 hover:text-ink"
                }`}
                aria-pressed={viewMode === "list"}
                title="Chế độ dọc (Danh sách)"
              >
                <ListIcon size={14} />
                <span>Dọc</span>
              </button>
            </div>
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
            showFilter={false}
            filter={filter}
            onFilterChange={handleFilterChange}
            viewMode={viewMode}
          />
          <UpcomingToast />
        </TaskStoreProvider>
      )}
    </div>
  );
}
