import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatMonthYear } from "../../components/calendar";
import { addDays } from "../../domain/dates";
import {
  entriesOf,
  entryForFilter,
  matchesEntry,
  type DayEntry,
} from "../../domain/entries";
import type { UpcomingFilter } from "../../domain/lists";
import type { Task, WeekStart } from "../../domain/types";
import {
  daysAfter,
  formatWeekRange,
  isCurrentWeek,
  shiftWeek,
  weekOf,
} from "../../domain/week";
import type { UpcomingViewMode, UpcomingWeekNavProps } from "./types";
import { useActiveDay } from "./useActiveDay";

export interface UseUpcomingListWindowOptions {
  today: string;
  anchor: string;
  weekStart: WeekStart;
  enabled?: boolean;
  barHeight?: number;
  initialDay?: string;
}

export function useStickyBarHeight(defaultHeight = 120) {
  const [barHeight, setBarHeight] = useState<number>(defaultHeight);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h =
          entry.borderBoxSize?.[0]?.blockSize ||
          (entry.target as HTMLElement | undefined)?.offsetHeight ||
          entry.contentRect?.height;
        if (h && h > 0) {
          setBarHeight(Math.round(h));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { barRef, barHeight };
}

export function useUpcomingListWindow({
  today,
  anchor,
  weekStart,
  enabled = true,
  barHeight: optionsBarHeight,
  initialDay,
}: UseUpcomingListWindowOptions) {
  const { barRef, barHeight: measuredBarHeight } = useStickyBarHeight(120);
  const barHeight = optionsBarHeight ?? measuredBarHeight;

  const windowDays = useMemo(() => {
    const week1 = weekOf(anchor, weekStart);
    const week2 = weekOf(shiftWeek(anchor, 1), weekStart);
    return daysAfter([...week1, ...week2], today);
  }, [anchor, weekStart, today]);

  const { activeDay, setActiveDay, holdActiveDay } = useActiveDay(
    initialDay ?? windowDays[0] ?? today,
    windowDays,
    { enabled, barHeight },
  );

  const initialDayRef = useRef(initialDay);
  useEffect(() => {
    const targetDay = initialDayRef.current;
    if (!targetDay) return;
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (cb: () => void) => setTimeout(cb, 0);
    raf(() => {
      holdActiveDay(targetDay);
      const el = document.getElementById("day-" + targetDay);
      if (typeof el?.scrollIntoView === "function") {
        el.scrollIntoView({ block: "start", behavior: "auto" });
      }
    });
  }, [holdActiveDay]);

  const scrollToDate = useCallback(
    (targetDate: string) => {
      if (targetDate <= today) {
        const tomorrow = addDays(today, 1);
        holdActiveDay(tomorrow);
        const target =
          document.getElementById("day-overdue") ??
          document.getElementById("day-" + tomorrow);
        if (typeof target?.scrollIntoView === "function") {
          target.scrollIntoView({ block: "start", behavior: "smooth" });
        } else {
          const raf =
            typeof requestAnimationFrame === "function"
              ? requestAnimationFrame
              : (cb: () => void) => setTimeout(cb, 0);
          raf(() => {
            const el =
              document.getElementById("day-overdue") ??
              document.getElementById("day-" + tomorrow);
            if (typeof el?.scrollIntoView === "function") {
              el.scrollIntoView({ block: "start", behavior: "smooth" });
            }
          });
        }
        return;
      }
      holdActiveDay(targetDate);
      const el = document.getElementById("day-" + targetDate);
      if (typeof el?.scrollIntoView === "function") {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        const raf =
          typeof requestAnimationFrame === "function"
            ? requestAnimationFrame
            : (cb: () => void) => setTimeout(cb, 0);
        raf(() => {
          const target = document.getElementById("day-" + targetDate);
          if (typeof target?.scrollIntoView === "function") {
            target.scrollIntoView({
              block: "start",
              behavior: "smooth",
            });
          }
        });
      }
    },
    [today, holdActiveDay],
  );

  // A week jump changes the rendered days, so it scrolls once they are on the page
  const pendingJump = useRef<string | null>(null);
  useLayoutEffect(() => {
    const day = pendingJump.current;
    if (!day) return;
    pendingJump.current = null;
    document
      .getElementById("day-" + day)
      ?.scrollIntoView?.({ block: "start", inline: "start", behavior: "auto" });
  });

  const jumpToDay = useCallback(
    (day: string) => {
      pendingJump.current = day;
      holdActiveDay(day);
    },
    [holdActiveDay],
  );

  const jumpToOverdue = useCallback(() => {
    pendingJump.current = "overdue";
    holdActiveDay(addDays(today, 1));
  }, [holdActiveDay, today]);

  const stripWeek = useMemo(
    () => weekOf(activeDay, weekStart),
    [activeDay, weekStart],
  );

  return {
    windowDays,
    activeDay,
    setActiveDay,
    holdActiveDay,
    stripWeek,
    scrollToDate,
    jumpToDay,
    jumpToOverdue,
    barRef,
    barHeight,
  };
}

export function groupUpcomingEntries(
  tasks: Task[],
  renderedDays: string[],
  stripDays: string[],
  filter: UpcomingFilter,
  isSettling: (id: string) => boolean,
): {
  entriesByDay: Record<string, DayEntry[]>;
  countsByDay: Record<string, number>;
} {
  const entriesByDay: Record<string, DayEntry[]> = {};
  const countsByDay: Record<string, number> = {};
  for (const d of stripDays) countsByDay[d] = 0;
  for (const d of renderedDays) {
    entriesByDay[d] = [];
    countsByDay[d] = 0;
  }
  for (const task of tasks) {
    if (task.done && !isSettling(task.id)) continue;
    const entries = entriesOf(task);
    for (const entry of entries) {
      if (!matchesEntry(entry, filter)) continue;
      if (!entriesByDay[entry.date]) entriesByDay[entry.date] = [];
      entriesByDay[entry.date].push(entryForFilter(entry, filter));
      countsByDay[entry.date] = (countsByDay[entry.date] ?? 0) + 1;
    }
  }
  return { entriesByDay, countsByDay };
}

export function getUpcomingNavProps({
  isBoard,
  anchor,
  setAnchor,
  today,
  weekStart,
  activeDay,
  overdueCount,
  jumpToDay,
  jumpToOverdue,
}: {
  isBoard: boolean;
  anchor: string;
  setAnchor: (date: string) => void;
  today: string;
  weekStart: WeekStart;
  activeDay: string;
  overdueCount: number;
  jumpToDay: (date: string) => void;
  jumpToOverdue: () => void;
}): UpcomingWeekNavProps {
  const currentDay = isBoard ? anchor : activeDay;
  const shownWeek = weekOf(currentDay, weekStart);
  const tomorrow = addDays(today, 1);
  const prevDisabled =
    shownWeek.includes(today) || shownWeek.includes(tomorrow);

  const onNext = () => {
    const target = addDays(shownWeek[0]!, 7);
    setAnchor(target);
    if (!isBoard) {
      jumpToDay(target);
    }
  };

  const onPrev = () => {
    const shifted = addDays(shownWeek[0]!, -7);
    const target = shifted > tomorrow ? shifted : tomorrow;
    setAnchor(target);
    if (!isBoard) {
      jumpToDay(target);
    }
  };

  const onPickDate = (picked: string) => {
    const target = picked <= today ? tomorrow : picked;
    setAnchor(target);
    if (!isBoard) {
      jumpToDay(target);
    }
  };

  return {
    monthLabel: formatMonthYear(currentDay),
    pickedDate: currentDay,
    weekStart,
    weekLabel: formatWeekRange(shownWeek),
    prevDisabled,
    overdueCount,
    onPrev,
    onNext,
    onPickDate,
    // The section only shows on the current week, so go back there first
    onOverdue: () => {
      setAnchor(today);
      jumpToOverdue();
    },
  };
}

export function useUpcomingScreenData({
  store,
  anchor,
  setAnchor,
  weekStart,
  viewMode,
  filter,
  initialDay,
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
}) {
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
  const { entriesByDay, countsByDay } = groupUpcomingEntries(
    store.tasks,
    renderedDays,
    stripDays,
    filter,
    store.isSettling,
  );

  const overdueTasks = useMemo(() => {
    return store.tasks
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
      );
  }, [store]);

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
