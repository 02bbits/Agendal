import { t } from "../copy";
import type { TimeFormat } from "./types";

// Floating local dates as `YYYY-MM-DD` strings. Arithmetic runs in UTC so no
// time zone or DST can shift a day (ADR-006). "Today" always comes from the
// caller's injected clock, never from `new Date()` here.

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** Today, Tomorrow, Yesterday as words; otherwise `Mon 26 Oct`, with the year when it isn't this year (UX-32). */
export function formatDay(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return t("date.today");
  if (diff === 1) return t("date.tomorrow");
  if (diff === -1) return t("date.yesterday");
  const d = parse(date);
  const short = `${WEEKDAYS[d.getUTCDay()]!.slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
  return date.slice(0, 4) === today.slice(0, 4)
    ? short
    : `${short} ${date.slice(0, 4)}`;
}

/** Overline above a screen title: `Thursday, 29 October` (shown uppercase by the overline style). */
export function formatLongDate(date: string): string {
  const d = parse(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** `16:00`, or `4:00 pm` with the 12-hour setting (AP-5). */
export function formatTime(time: string, format: TimeFormat): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const mm = String(m).padStart(2, "0");
  if (format === "24h") return `${String(h).padStart(2, "0")}:${mm}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "am" : "pm"}`;
}

/** `16:00 – 17:00`, or just the start when there is no end (NF-12). */
export function formatTimeRange(
  start: string,
  end: string | null,
  format: TimeFormat,
): string {
  return end
    ? `${formatTime(start, format)} – ${formatTime(end, format)}`
    : formatTime(start, format);
}
