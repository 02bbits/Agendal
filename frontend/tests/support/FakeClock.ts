import type { Clock, LocalParts } from "@/lib/clock/types";
import {
  formatLocalDate,
  formatLocalTime,
  getLocalParts,
} from "@/lib/clock/timezone";

/**
 * FakeClock for tests with frozen, controllable time.
 */
export class FakeClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: string | Date | number) {
    this.currentTime = new Date(initialTime);
    if (isNaN(this.currentTime.getTime())) {
      throw new Error(
        `Invalid initialTime provided to FakeClock: ${String(initialTime)}`,
      );
    }
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  nowMs(): number {
    return this.currentTime.getTime();
  }

  toISOString(): string {
    return this.currentTime.toISOString();
  }

  today(timezone: string): string {
    return formatLocalDate(this.currentTime, timezone);
  }

  time(timezone: string): string {
    return formatLocalTime(this.currentTime, timezone);
  }

  toLocalParts(instant: Date | number, timezone: string): LocalParts {
    const d = typeof instant === "number" ? new Date(instant) : instant;
    return getLocalParts(d, timezone);
  }

  advanceMs(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  advanceSeconds(seconds: number): void {
    this.advanceMs(seconds * 1000);
  }

  advanceMinutes(minutes: number): void {
    this.advanceMs(minutes * 60 * 1000);
  }

  advanceHours(hours: number): void {
    this.advanceMs(hours * 3600 * 1000);
  }

  advanceDays(days: number): void {
    this.advanceMs(days * 86400 * 1000);
  }

  setTime(time: string | Date | number): void {
    const next = new Date(time);
    if (isNaN(next.getTime())) {
      throw new Error(`Invalid time provided to setTime: ${String(time)}`);
    }
    this.currentTime = next;
  }
}
