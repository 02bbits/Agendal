import { useMemo } from "react";
import type { UpcomingFilter } from "../../domain/lists";
import type { Task, WeekStart } from "../../domain/types";
import { daysAfter, isCurrentWeek, shiftWeek, weekOf } from "../../domain/week";
import type { UpcomingViewMode } from "./types";
import { groupUpcomingEntries } from "./upcomingEntries";
import { useFrozenOrder } from "./useFrozenOrder";
import { getUpcomingNavProps } from "./upcomingNav";
import { useUpcomingListWindow } from "./useUpcomingListWindow";

/** Everything Upcoming draws: the days shown, their entries and counts, Overdue and the week bar. */
export function useUpcomingScreenData({
  store,
  anchor,
  setAnchor,
  weekStart,
  viewMode,
  filter,
  initialDay,
  selectedTaskId,
}: {
  store: {
    tasks: Task[];
    today: string;
    isSettling: (id: string) => boolean;
  };
  anchor: string;
  setAnchor: (date: string) => void;
  weekStart: WeekStart;
  viewMode: UpcomingViewMode;
  filter: UpcomingFilter;
  initialDay?: string;
  /** The task open in the panel keeps its place until the panel closes. */
  selectedTaskId?: string | null;
}) {
  const frozen = useFrozenOrder(store.tasks, selectedTaskId);
  const isBoard = viewMode === "board";
  const listWindow = useUpcomingListWindow({
    today: store.today,
    anchor,
    weekStart,
    enabled: !isBoard,
    initialDay,
  });

  const boardDays = useMemo(() => {
    const week = weekOf(anchor, weekStart);
    const after = daysAfter(week, store.today);
    return after.length === 0 ? weekOf(shiftWeek(anchor, 1), weekStart) : after;
  }, [anchor, weekStart, store.today]);

  const renderedDays = isBoard ? boardDays : listWindow.windowDays;
  const stripDays = isBoard ? weekOf(anchor, weekStart) : listWindow.stripWeek;
  const grouped = groupUpcomingEntries(
    frozen.layout,
    renderedDays,
    stripDays,
    filter,
    store.isSettling,
  );
  const { countsByDay } = grouped;
  const entriesByDay = Object.fromEntries(
    Object.entries(grouped.entriesByDay).map(([day, entries]) => [
      day,
      entries.map((e) => ({ ...e, task: frozen.live(e.task) })),
    ]),
  );

  const overdueTasks = useMemo(() => {
    return frozen.layout
      .filter(
        (t) =>
          (!t.done || store.isSettling(t.id)) &&
          t.due_date &&
          t.due_date < store.today,
      )
      .sort(
        (a, b) =>
          a.due_date!.localeCompare(b.due_date!) ||
          a.created_at.localeCompare(b.created_at),
      )
      .map(frozen.live);
  }, [frozen, store]);

  // By the anchor, not the strip: scrolling into next week must not remove the section
  const isCurrent = isCurrentWeek(weekOf(anchor, weekStart), store.today);
  const visibleOverdue = isCurrent ? overdueTasks : [];

  const navProps = getUpcomingNavProps({
    isBoard,
    anchor,
    setAnchor,
    today: store.today,
    weekStart,
    activeDay: listWindow.activeDay,
    overdueCount: overdueTasks.length,
    jumpToDay: listWindow.jumpToDay,
    jumpToOverdue: listWindow.jumpToOverdue,
  });

  return {
    isBoard,
    listWindow,
    renderedDays,
    entriesByDay,
    overdueTasks: visibleOverdue,
    countsByDay,
    navProps,
    barRef: listWindow.barRef,
    barHeight: listWindow.barHeight,
  };
}
