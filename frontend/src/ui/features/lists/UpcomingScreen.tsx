import { useState, type ReactElement } from "react";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/ChipGroup";
import { CalendarIcon, ClockIcon, PlusIcon } from "../../components/icons";
import { t } from "../../copy";
import { ScreenHeader } from "../shell/ScreenHeader";
import { useTaskStore } from "../tasks/store";
import { useUpcomingPreferences } from "./storage";
import type { UpcomingScreenProps, UpcomingViewMode } from "./types";
import { UpcomingBoard } from "./UpcomingBoard";
import { UpcomingDayList } from "./UpcomingDayList";
import { UpcomingDayStrip } from "./UpcomingDayStrip";
import { UpcomingViewSwitch } from "./UpcomingViewSwitch";
import { UpcomingWeekNav } from "./UpcomingWeekNav";
import { useUpcomingScreenData } from "./useUpcomingListWindow";

export type { UpcomingScreenProps, UpcomingViewMode };

export function UpcomingScreen(props: UpcomingScreenProps): ReactElement {
  const {
    accountInitial = "",
    navigate,
    onNewTask,
    onAddTask,
    subtitle,
    showHeader = true,
    showFilter = true,
    selectedTaskId,
    weekStart = "mon",
  } = props;

  const store = useTaskStore();
  const [anchor, setAnchor] = useState<string>(() => store.today);
  const { filter, chooseFilter, viewMode, chooseViewMode } =
    useUpcomingPreferences(props, () => setAnchor(listWindow.activeDay));

  const {
    isBoard,
    listWindow,
    renderedDays,
    tasksByDay,
    countsByDay,
    navProps,
  } = useUpcomingScreenData({
    store,
    anchor,
    setAnchor,
    weekStart,
    viewMode,
    filter,
  });

  const viewProps = {
    days: renderedDays,
    tasksByDay,
    today: store.today,
    selectedTaskId,
    navigate,
    onAddTask: (d: string) => (onAddTask ? onAddTask(d) : onNewTask?.()),
  };

  const filterChips = (
    <ChipGroup
      label={t("list.filter_label")}
      value={filter}
      onChange={chooseFilter}
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
  );

  const hasTasks = store.tasks.some((t) => !t.done || store.isSettling(t.id));

  return (
    <div className="pb-8">
      {showHeader && (
        <ScreenHeader
          overline=""
          title={t("nav.upcoming")}
          accountInitial={accountInitial}
          navigate={navigate}
          action={
            <div className="flex items-center gap-3">
              <div className="hidden md:block">{filterChips}</div>
              <UpcomingViewSwitch
                viewMode={viewMode}
                onChange={chooseViewMode}
              />
              {onNewTask && (
                <Button
                  variant="primary"
                  pill
                  className="hidden h-10 min-h-10 px-5 text-callout font-medium md:inline-flex"
                  onClick={onNewTask}
                >
                  <PlusIcon size={16} />
                  {t("task.new")}
                </Button>
              )}
            </div>
          }
        >
          {subtitle && (
            <p className="m-0 mt-1 text-footnote text-ink-secondary">
              {subtitle}
            </p>
          )}
          <div className="mt-4 md:hidden">{filterChips}</div>
        </ScreenHeader>
      )}

      {showFilter && !showHeader && <div className="mb-4">{filterChips}</div>}

      <div className="sticky top-0 z-20 border-b border-separator bg-paper pb-2">
        <UpcomingWeekNav {...navProps} />
        {!isBoard && (
          <UpcomingDayStrip
            week={listWindow.stripWeek}
            today={store.today}
            activeDay={listWindow.activeDay}
            countsByDay={countsByDay}
            onPickDay={listWindow.scrollToDate}
          />
        )}
      </div>

      {!hasTasks && <h2 className="sr-only">{t("list.upcoming_empty")}</h2>}

      <div className="mt-6">
        {isBoard ? (
          <UpcomingBoard {...viewProps} />
        ) : (
          <UpcomingDayList {...viewProps} />
        )}
      </div>
    </div>
  );
}
