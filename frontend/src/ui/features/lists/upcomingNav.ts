import { formatMonthYear } from "../../components/calendar";
import { addDays } from "../../domain/dates";
import type { WeekStart } from "../../domain/types";
import { formatWeekRange, weekOf } from "../../domain/week";
import type { UpcomingWeekNavProps } from "./types";

/**
 * The month and week bar: the week shown, Previous (never before the current week) and Next, a
 * picked date, and Overdue, which goes back to the current week first.
 */
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
