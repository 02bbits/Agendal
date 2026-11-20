import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addDays } from "../../domain/dates";
import type { WeekStart } from "../../domain/types";
import { daysAfter, shiftWeek, weekOf } from "../../domain/week";
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

const OVERDUE_ID = "day-overdue";
const dayId = (day: string) => `day-${day}`;

/** After the next paint, or at once where frames don't run (tests). */
const nextFrame = (run: () => void) =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(run)
    : setTimeout(run, 0);

/**
 * Scrolls the first of `ids` on the page to the top. Not rendered yet (a week just switched):
 * tries once more after the next paint.
 */
function scrollToFirst(ids: string[], behavior: ScrollBehavior) {
  const scroll = () => {
    const target = ids
      .map((id) => document.getElementById(id))
      .find((el) => el !== null);
    if (typeof target?.scrollIntoView !== "function") return false;
    target.scrollIntoView({ block: "start", behavior });
    return true;
  };
  if (!scroll()) nextFrame(scroll);
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

  const initialValidDay =
    initialDay && initialDay.trim().length > 0 ? initialDay : undefined;

  const { activeDay, setActiveDay, holdActiveDay } = useActiveDay(
    initialValidDay ?? windowDays[0] ?? today,
    windowDays,
    { enabled, barHeight },
  );

  const initialDayRef = useRef(initialValidDay);
  useEffect(() => {
    const targetDay = initialDayRef.current;
    if (!targetDay) return;
    nextFrame(() => {
      holdActiveDay(targetDay);
      document
        .getElementById(dayId(targetDay))
        ?.scrollIntoView?.({ block: "start", behavior: "auto" });
    });
  }, [holdActiveDay]);

  // A day on or before today goes to Overdue (or tomorrow when there is none)
  const scrollToDate = useCallback(
    (targetDate: string) => {
      if (targetDate <= today) {
        const tomorrow = addDays(today, 1);
        holdActiveDay(tomorrow);
        scrollToFirst([OVERDUE_ID, dayId(tomorrow)], "smooth");
        return;
      }
      holdActiveDay(targetDate);
      scrollToFirst([dayId(targetDate)], "smooth");
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
