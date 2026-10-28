import type { ComputeRemindAtParams, ReminderOffset } from "./types";
import { parseWallClockInTimezone } from "./timezone";

/**
 * Compute UTC remind_at timestamp from floating local date/time + reminder offset + user timezone.
 * Conforms to ADR-006:
 * - Floating time + timezone -> UTC remind_at.
 * - Reminder offset: "5m", "15m", "30m", "1h", "1d", or "none".
 * - If no start_time, default reference is 09:00 on due_date.
 * - Returns ISO 8601 UTC string (e.g. "2026-10-25T02:00:00.000Z"), or null if reminder is "none".
 */
export function computeRemindAtUtc({
  dueDate,
  startTime,
  reminder,
  timezone,
}: ComputeRemindAtParams): string | null {
  if (!reminder || reminder === "none") {
    return null;
  }

  const timeStr = startTime || "09:00";
  const targetWallInstant = parseWallClockInTimezone(
    dueDate,
    timeStr,
    timezone,
  );

  const offsetMinutesMap: Record<Exclude<ReminderOffset, "none">, number> = {
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
    "1d": 1440,
  };

  const offsetMinutes = offsetMinutesMap[reminder];
  if (offsetMinutes === undefined) {
    throw new Error(`Unknown reminder offset: ${reminder}`);
  }

  const remindAtTimestamp =
    targetWallInstant.getTime() - offsetMinutes * 60 * 1000;
  return new Date(remindAtTimestamp).toISOString();
}
