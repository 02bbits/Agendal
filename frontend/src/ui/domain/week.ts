import { t } from "../copy";
import { addDays, startOfWeek } from "./dates";
import type { WeekStart } from "./types";

function parseUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

/** The 7 dates (YYYY-MM-DD) of the week containing `anchor`, aligned to `weekStart`. */
export function weekOf(anchor: string, weekStart: WeekStart): string[] {
  const start = startOfWeek(anchor, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The days >= today (past days of the current week are hidden). */
export function visibleDays(week: string[], today: string): string[] {
  return week.filter((d) => d >= today);
}

/** The days > today (today and past days are hidden for Upcoming). */
export function daysAfter(week: string[], today: string): string[] {
  return week.filter((d) => d > today);
}

/** Shift anchor date by `delta` weeks (7 * delta days). */
export function shiftWeek(anchor: string, delta: number): string {
  return addDays(anchor, 7 * delta);
}

/** Returns true if the week array contains `today`. */
export function isCurrentWeek(week: string[], today: string): boolean {
  return week.includes(today);
}

/** Formats a 7-day week range: "2 – 8 Nov" or "30 Nov – 6 Dec". */
export function formatWeekRange(week: string[]): string {
  if (week.length === 0) return "";
  const start = parseUtc(week[0]!);
  const end = parseUtc(week[week.length - 1]!);
  const monthFmt = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const startMonth = monthFmt.format(start);
  const endMonth = monthFmt.format(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();

  if (startMonth === endMonth) {
    return `${startDay} – ${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

/**
 * Format heading for list view:
 * "2 Nov · Today · Monday", "3 Nov · Tomorrow · Tuesday", else "4 Nov · Wednesday".
 */
export function dayHeading(date: string, today: string): string {
  const d = parseUtc(date);
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  }).format(d);

  if (date === today) {
    return t("list.day_heading_rel", {
      date: dateStr,
      rel: t("date.today"),
      weekday,
    });
  }
  if (date === addDays(today, 1)) {
    return t("list.day_heading_rel", {
      date: dateStr,
      rel: t("date.tomorrow"),
      weekday,
    });
  }
  return t("list.day_heading", { date: dateStr, weekday });
}

/**
 * Short heading for board column:
 * "2 Nov · Today", "3 Nov · Tomorrow", else "4 Nov · Wednesday".
 */
export function dayHeadingShort(date: string, today: string): string {
  const d = parseUtc(date);
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  }).format(d);

  if (date === today) {
    return t("list.day_heading_short_rel", {
      date: dateStr,
      rel: t("date.today"),
    });
  }
  if (date === addDays(today, 1)) {
    return t("list.day_heading_short_rel", {
      date: dateStr,
      rel: t("date.tomorrow"),
    });
  }
  return t("list.day_heading", { date: dateStr, weekday });
}

/** Week strip label: "Mon", 2 */
export function stripLabel(date: string): { weekday: string; day: number } {
  const d = parseUtc(date);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(d);
  return { weekday, day: d.getUTCDate() };
}
