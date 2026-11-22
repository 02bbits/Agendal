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
import { sortEntries } from "../../domain/entries";
import { TaskDndScope } from "./dnd/TaskDndScope";
import { SortMenu } from "./SortMenu";
import { useUpcomingPreferences } from "./storage";
import { useSortByRules } from "./useSortByRules";
import type { UpcomingScreenProps, UpcomingViewMode } from "./types";
import { UpcomingBoard } from "./UpcomingBoard";
import { UpcomingDayList } from "./UpcomingDayList";
import { UpcomingDayStrip } from "./UpcomingDayStrip";
import { UpcomingViewSwitch } from "./UpcomingViewSwitch";
import { UpcomingWeekNav } from "./UpcomingWeekNav";
import { useUpcomingScreenData } from "./useUpcomingScreenData";

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
    selectedTaskId: props.selectedTaskId,
  });

  const onViewChange = props.onViewChange;
  const currentActiveDay = isBoard ? anchor : listWindow.activeDay;
  useEffect(() => {
    onViewChange?.({ anchor, day: currentActiveDay });
  }, [anchor, currentActiveDay, onViewChange]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (viewMode === "board") {
        document.documentElement.dataset.boardView = "true";
      } else {
        delete document.documentElement.dataset.boardView;
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        delete document.documentElement.dataset.boardView;
      }
    };
  }, [viewMode]);

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

  // Sort by rules: every day shown, normal entries in rule order; one rising run of keys
  // keeps each day in order (a task's day_order only meets other tasks of its own day)
  const sortUpcomingByRules = useSortByRules("upcoming", "day_order");
  const sortMenu = (
    <SortMenu
      list="upcoming"
      listName={t("nav.upcoming")}
      onSortByRules={() =>
        sortUpcomingByRules(
          renderedDays.flatMap((day) =>
            sortEntries(entriesByDay[day] ?? []).normal.map((e) => e.task),
          ),
        )
      }
    />
  );

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
  const hasFilteredEntries =
    Object.values(entriesByDay).some((entries) => entries.length > 0) ||
    overdueTasks.length > 0;
  const isFilterEmpty = filter !== "all" && !hasFilteredEntries;

  const filterEmptyFullText = t("list.filter_empty");
  const showAllText = t("common.show_all");
  const [filterEmptyPrefix] = filterEmptyFullText.split(showAllText);

  const { showHeader = true, showFilter = true } = props;

  return (
    <TaskDndScope>
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
                {sortMenu}
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

        {isFilterEmpty ? (
          <p className="mt-8 text-center text-callout text-ink-secondary">
            <span>{filterEmptyPrefix}</span>
            <button
              type="button"
              onClick={() => chooseFilter("all")}
              className="link-swipe cursor-pointer font-medium text-primary"
            >
              {showAllText}
            </button>
          </p>
        ) : (
          !hasTasks && <h2 className="sr-only">{t("list.upcoming_empty")}</h2>
        )}

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
    </TaskDndScope>
  );
}
