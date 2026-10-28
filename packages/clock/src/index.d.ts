export interface Clock {
  now(): Date;
  nowMs(): number;
  toISOString(): string;
  today(timezone: string): string;
  time(timezone: string): string;
  toLocalParts(instant: Date | number, timezone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dateString: string;
    timeString: string;
  };
}

export class SystemClock implements Clock {
  now(): Date;
  nowMs(): number;
  toISOString(): string;
  today(timezone: string): string;
  time(timezone: string): string;
  toLocalParts(instant: Date | number, timezone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dateString: string;
    timeString: string;
  };
}

export class FakeClock implements Clock {
  constructor(initialTime?: Date | string | number);
  now(): Date;
  nowMs(): number;
  toISOString(): string;
  today(timezone: string): string;
  time(timezone: string): string;
  toLocalParts(instant: Date | number, timezone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dateString: string;
    timeString: string;
  };
  advanceMs(ms: number): void;
  advanceSeconds(seconds: number): void;
  advanceMinutes(minutes: number): void;
  advanceHours(hours: number): void;
  advanceDays(days: number): void;
  setTime(time: Date | string | number): void;
}

export function formatLocalDate(date: Date, timezone: string): string;
export function formatLocalTime(date: Date, timezone: string): string;
export function getLocalParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateString: string;
  timeString: string;
};
export function computeRemindAtUtc(options: {
  dueDate: string;
  startTime?: string | null;
  reminder: 'none' | '5m' | '15m' | '30m' | '1h' | '1d';
  timezone: string;
}): string | null;
export function parseWallClockInTimezone(
  dateString: string,
  timeString: string,
  timezone: string
): Date;
