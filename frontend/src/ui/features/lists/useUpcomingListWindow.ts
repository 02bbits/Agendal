import { useCallback, useMemo } from "react";
import { formatMonthYear } from "../../components/calendar";
import { matchesFilter, type UpcomingFilter } from "../../domain/lists";
import type { Task, WeekStart } from "../../domain/types";
import {
  isCurrentWeek,
  shiftWeek,
  visibleDays,
  weekOf,
} from "../../domain/week";
import type { UpcomingViewMode, UpcomingWeekNavProps } from "./types";
import { useActiveDay } from "./useActiveDay";

export interface UseUpcomingListWindowOptions {
  today: string;
  anchor: string;
  setAnchor: (date: string) => void;
  weekStart: WeekStart;
  enabled?: boolean;
}

export function useUpcomingListWindow({
  today,
  anchor,
  setAnchor,
  weekStart,
  enabled = true,
}: UseUpcomingListWindowOptions) {
  const windowDays = useMemo(() => {
    const week1 = weekOf(anchor, weekStart);
    const week2 = weekOf(shiftWeek(anchor, 1), weekStart);
    return visibleDays([...week1, ...week2], today);
  }, [anchor, weekStart, today]);

  const { activeDay, setActiveDay } = useActiveDay(
    windowDays[0] ?? today,
    windowDays,
    { enabled, barHeight: 120 },
  );

  const scrollToDate = useCallback(
    (targetDate: string) => {
      const date = targetDate < today ? today : targetDate;
      setActiveDay(date);
      const el = document.getElementById("day-" + date);
      if (typeof el?.scrollIntoView === "function") {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        const raf =
          typeof requestAnimationFrame === "function"
            ? requestAnimationFrame
            : (cb: () => void) => setTimeout(cb, 0);
        raf(() => {
          const target = document.getElementById("day-" + date);
          if (typeof target?.scrollIntoView === "function") {
            target.scrollIntoView({
              block: "start",
              behavior: "smooth",
            });
          }
        });
      }
    },
    [today, setActiveDay],
  );

  const stripWeek = useMemo(
    () => weekOf(activeDay, weekStart),
    [activeDay, weekStart],
  );

  const onPrev = useCallback(() => {
    const prevAnchor = shiftWeek(anchor, -1);
    setAnchor(prevAnchor);
    const prevDays = visibleDays(
      [
        ...weekOf(prevAnchor, weekStart),
        ...weekOf(shiftWeek(prevAnchor, 1), weekStart),
      ],
      today,
    );
    if (prevDays[0]) {
      scrollToDate(prevDays[0]);
    }
  }, [anchor, weekStart, today, setAnchor, scrollToDate]);

  const onNext = useCallback(() => {
    const nextAnchor = shiftWeek(anchor, 1);
    setAnchor(nextAnchor);
    const nextDays = visibleDays(
      [
        ...weekOf(nextAnchor, weekStart),
        ...weekOf(shiftWeek(nextAnchor, 1), weekStart),
      ],
      today,
    );
    if (nextDays[0]) {
      scrollToDate(nextDays[0]);
    }
  }, [anchor, weekStart, today, setAnchor, scrollToDate]);

  const onToday = useCallback(() => {
    setAnchor(today);
    scrollToDate(today);
  }, [today, setAnchor, scrollToDate]);

  const onPickDate = useCallback(
    (picked: string) => {
      const target = picked < today ? today : picked;
      setAnchor(target);
      scrollToDate(target);
    },
    [today, setAnchor, scrollToDate],
  );

  return {
    windowDays,
    activeDay,
    setActiveDay,
    stripWeek,
    scrollToDate,
    onPrev,
    onNext,
    onToday,
    onPickDate,
  };
}

export function groupUpcomingTasks(
  tasks: Task[],
  renderedDays: string[],
  stripDays: string[],
  filter: UpcomingFilter,
  isSettling: (id: string) => boolean,
): { tasksByDay: Record<string, Task[]>; countsByDay: Record<string, number> } {
  const tasksByDay: Record<string, Task[]> = {};
  const countsByDay: Record<string, number> = {};
  for (const d of stripDays) countsByDay[d] = 0;
  for (const d of renderedDays) {
    tasksByDay[d] = [];
    countsByDay[d] = 0;
  }
  for (const task of tasks) {
    if (!task.due_date) continue;
    if (task.done && !isSettling(task.id)) continue;
    if (!matchesFilter(task, filter)) continue;
    if (!tasksByDay[task.due_date]) tasksByDay[task.due_date] = [];
    tasksByDay[task.due_date].push(task);
    countsByDay[task.due_date] = (countsByDay[task.due_date] ?? 0) + 1;
  }
  return { tasksByDay, countsByDay };
}

export function getUpcomingNavProps(
  isBoard: boolean,
  anchor: string,
  setAnchor: (date: string) => void,
  today: string,
  weekStart: WeekStart,
  listWindow: ReturnType<typeof useUpcomingListWindow>,
): UpcomingWeekNavProps {
  return {
    monthLabel: formatMonthYear(isBoard ? anchor : listWindow.activeDay),
    pickedDate: isBoard ? anchor : listWindow.activeDay,
    weekStart,
    prevDisabled: isCurrentWeek(weekOf(anchor, weekStart), today),
    onPrev: isBoard
      ? () => setAnchor(shiftWeek(anchor, -1))
      : listWindow.onPrev,
    onToday: isBoard ? () => setAnchor(today) : listWindow.onToday,
    onNext: isBoard ? () => setAnchor(shiftWeek(anchor, 1)) : listWindow.onNext,
    onPickDate: isBoard
      ? (p) => setAnchor(p < today ? today : p)
      : listWindow.onPickDate,
  };
}

export function useUpcomingScreenData({
  store,
  anchor,
  setAnchor,
  weekStart,
  viewMode,
  filter,
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
}) {
  const isBoard = viewMode === "board";
  const listWindow = useUpcomingListWindow({
    today: store.today,
    anchor,
    setAnchor,
    weekStart,
    enabled: !isBoard,
  });

  const boardDays = useMemo(
    () => visibleDays(weekOf(anchor, weekStart), store.today),
    [anchor, weekStart, store.today],
  );

  const renderedDays = isBoard ? boardDays : listWindow.windowDays;
  const stripDays = isBoard ? weekOf(anchor, weekStart) : listWindow.stripWeek;
  const { tasksByDay, countsByDay } = groupUpcomingTasks(
    store.tasks,
    renderedDays,
    stripDays,
    filter,
    store.isSettling,
  );

  const navProps = getUpcomingNavProps(
    isBoard,
    anchor,
    setAnchor,
    store.today,
    weekStart,
    listWindow,
  );

  return {
    isBoard,
    listWindow,
    renderedDays,
    tasksByDay,
    countsByDay,
    navProps,
  };
}
