import type { Clock, LocalParts } from "./types";
import { formatLocalDate, formatLocalTime, getLocalParts } from "./timezone";

/**
 * System Clock reading the machine's real time.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowMs(): number {
    return Date.now();
  }

  toISOString(): string {
    return this.now().toISOString();
  }

  today(timezone: string): string {
    return formatLocalDate(this.now(), timezone);
  }

  time(timezone: string): string {
    return formatLocalTime(this.now(), timezone);
  }

  toLocalParts(instant: Date | number, timezone: string): LocalParts {
    const d = typeof instant === "number" ? new Date(instant) : instant;
    return getLocalParts(d, timezone);
  }
}
