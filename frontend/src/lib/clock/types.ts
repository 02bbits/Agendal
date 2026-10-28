export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateString: string;
  timeString: string;
}

export type ReminderOffset = "5m" | "15m" | "30m" | "1h" | "1d" | "none";

export interface ComputeRemindAtParams {
  dueDate: string;
  startTime?: string | null;
  reminder?: ReminderOffset | null;
  timezone: string;
}

export interface Clock {
  now(): Date;
  nowMs(): number;
  toISOString(): string;
  today(timezone: string): string;
  time(timezone: string): string;
  toLocalParts(instant: Date | number, timezone: string): LocalParts;
}
