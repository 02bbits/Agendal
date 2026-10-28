import type { LocalParts } from "./types";

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const TRANSITION_WINDOW_HOURS = 48;
const OFFSET_SAMPLE_STEP_HOURS = 6;

/**
 * Format Date to local YYYY-MM-DD in the given timezone.
 */
export function formatLocalDate(date: Date, timezone: string): string {
  const parts = getLocalParts(date, timezone);
  return parts.dateString;
}

/**
 * Format Date to local HH:mm in the given timezone.
 */
export function formatLocalTime(date: Date, timezone: string): string {
  const parts = getLocalParts(date, timezone);
  return parts.timeString;
}

/**
 * Break an instant down into local wall-clock components for a given timezone.
 */
export function getLocalParts(date: Date, timezone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    else if (part.type === "month") month = parseInt(part.value, 10);
    else if (part.type === "day") day = parseInt(part.value, 10);
    else if (part.type === "hour") {
      const h = parseInt(part.value, 10);
      hour = h === 24 ? 0 : h;
    } else if (part.type === "minute") minute = parseInt(part.value, 10);
    else if (part.type === "second") second = parseInt(part.value, 10);
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateString: `${year}-${mm}-${dd}`,
    timeString: `${hh}:${min}`,
  };
}

/** ADR-006: choose the first repeated minute, or the next valid minute in a gap. */
export function parseWallClockInTimezone(
  dateString: string,
  timeString: string,
  timezone: string,
): Date {
  const wallTime = new Date(`${dateString}T${timeString}:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString) ||
    !/^\d{2}:\d{2}$/.test(timeString) ||
    !Number.isFinite(wallTime.getTime()) ||
    wallTime.toISOString().slice(0, 16) !== `${dateString}T${timeString}`
  ) {
    throw new RangeError(
      `Invalid local date/time: ${dateString} ${timeString}`,
    );
  }

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const localTimestamp = (instant: number): number => {
    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
    );
    return new Date(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`,
    ).getTime();
  };
  const wallMs = wallTime.getTime();
  const offsets = new Set<number>();
  // Include both sides of a transition, including zones with non-hour DST changes.
  for (
    let hours = -TRANSITION_WINDOW_HOURS;
    hours <= TRANSITION_WINDOW_HOURS;
    hours += OFFSET_SAMPLE_STEP_HOURS
  ) {
    const instant = wallMs + hours * MILLISECONDS_PER_HOUR;
    offsets.add(localTimestamp(instant) - instant);
  }
  const candidates = [...offsets]
    .map((offset) => wallMs - offset)
    .sort((a, b) => a - b);
  const exact = candidates.find(
    (instant) => localTimestamp(instant) === wallMs,
  );
  if (exact !== undefined) return new Date(exact);

  // The requested minute is inside a forward jump. Find the start of valid time.
  let nextInstant = candidates[candidates.length - 1];
  let nextLocal = Number.POSITIVE_INFINITY;
  for (
    let instant = candidates[0];
    instant <= candidates[candidates.length - 1];
    instant += MILLISECONDS_PER_MINUTE
  ) {
    const local = localTimestamp(instant);
    if (local >= wallMs && local < nextLocal) {
      nextInstant = instant;
      nextLocal = local;
    }
  }
  return new Date(nextInstant);
}
