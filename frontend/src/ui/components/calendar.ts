import { addDays, startOfWeek } from "../domain/dates";
import type { WeekStart } from "../domain/types";

export interface CalendarDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export type CalendarWeek = CalendarDay[];

/**
 * Builds a month grid as an array of weeks (7 days each),
 * aligned to `weekStart` ("mon" | "sun").
 */
export function buildMonthGrid(
  monthDate: string,
  weekStart: WeekStart,
  todayDate: string,
  selectedDate?: string | null,
): CalendarWeek[] {
  const [yStr, mStr] = monthDate.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;

  let current = startOfWeek(firstOfMonth, weekStart);
  const weeks: CalendarWeek[] = [];

  while (true) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const [cy, cm, cd] = current.split("-").map(Number);
      week.push({
        date: current,
        dayNumber: cd!,
        isCurrentMonth: cy === year && cm === month,
        isToday: current === todayDate,
        isSelected: current === selectedDate,
      });
      current = addDays(current, 1);
    }
    weeks.push(week);

    const [ny, nm] = current.split("-").map(Number);
    const pastMonthEnd = ny! > year || (ny === year && nm! > month);
    if (pastMonthEnd && weeks.length >= 4) {
      break;
    }
  }

  return weeks;
}

/** Formats a YYYY-MM-DD date as "Month Year", e.g. "October 2026". */
export function formatMonthYear(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, 1)));
}

/** Returns short weekday labels starting from weekStart ("mon" | "sun"). */
export function getWeekdayLabels(weekStart: WeekStart): string[] {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
  const sunday = "2026-10-04";
  const start = weekStart === "mon" ? addDays(sunday, 1) : sunday;
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const [y, m, day] = d.split("-").map(Number);
    return formatter.format(new Date(Date.UTC(y!, m! - 1, day!)));
  });
}

/** Shifts date by delta months (clamping day to max days of target month). */
export function shiftMonth(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const targetMonthDate = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  const ty = targetMonthDate.getUTCFullYear();
  const tm = targetMonthDate.getUTCMonth();
  const maxDays = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const targetDay = Math.min(d ?? 1, maxDays);
  return `${ty}-${String(tm + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}
