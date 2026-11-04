import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
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
  const store = useTaskStore();
  const initialViewResolved =
    typeof props.initialView === "function"
      ? props.initialView()
      : props.initialView;
  const [anchor, setAnchor] = useState<string>(
    () => initialViewResolved?.anchor ?? store.today,
  );
  const { filter, chooseFilter, viewMode, chooseViewMode } =
    useUpcomingPreferences(props, () => setAnchor(listWindow.activeDay));

  const {
    isBoard,
    listWindow,
    renderedDays,
    entriesByDay,
    overdueTasks,
    countsByDay,
    navProps,
    barRef,
    barHeight,
  } = useUpcomingScreenData({
    store,
    anchor,
    setAnchor,
    weekStart: props.weekStart ?? "mon",
    viewMode,
    filter,
    initialDay: initialViewResolved?.day,
  });

  const onViewChange = props.onViewChange;
  const currentActiveDay = isBoard ? anchor : listWindow.activeDay;
  useEffect(() => {
    onViewChange?.({ anchor, day: currentActiveDay });
  }, [anchor, currentActiveDay, onViewChange]);

  const viewProps = {
    days: renderedDays,
    entriesByDay,
    overdueTasks,
    today: store.today,
    selectedTaskId: props.selectedTaskId,
    navigate: props.navigate,
    onAddTask: (d: string) =>
      props.onAddTask ? props.onAddTask(d) : props.onNewTask?.(),
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
  const { showHeader = true, showFilter = true } = props;

  return (
    <div className="pb-8">
      {showHeader && (
        <ScreenHeader
          overline=""
          title={t("nav.upcoming")}
          accountInitial={props.accountInitial ?? ""}
          navigate={props.navigate}
          action={
            <div className="flex items-center gap-3">
              <div className="hidden md:block">{filterChips}</div>
              <UpcomingViewSwitch
                viewMode={viewMode}
                onChange={chooseViewMode}
              />
              {props.onNewTask && (
                <Button
                  variant="primary"
                  pill
                  className="hidden h-10 min-h-10 px-5 text-callout font-medium md:inline-flex"
                  onClick={props.onNewTask}
                >
                  <PlusIcon size={16} />
                  {t("task.new")}
                </Button>
              )}
            </div>
          }
        >
          {props.subtitle && (
            <p className="m-0 mt-1 text-footnote text-ink-secondary">
              {props.subtitle}
            </p>
          )}
          <div className="mt-4 md:hidden">{filterChips}</div>
        </ScreenHeader>
      )}

      {showFilter && !showHeader && <div className="mb-4">{filterChips}</div>}

      <div
        ref={barRef}
        className="sticky top-0 z-20 border-b border-separator bg-paper pb-2"
      >
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

      <div
        className="mt-6"
        style={{ "--upcoming-bar-h": `${barHeight}px` } as CSSProperties}
      >
        {isBoard ? (
          <UpcomingBoard {...viewProps} />
        ) : (
          <UpcomingDayList {...viewProps} />
        )}
      </div>
    </div>
  );
}
