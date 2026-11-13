import { t } from "../copy";
import type { Repeat, WeekStart } from "./types";

/** A task's repeat as the API stores it: the frequency plus an optional RRULE (#154). */
export interface RepeatValue {
  repeat: Repeat;
  repeat_rule: string | null;
}

export type RepeatPresetId =
  | "never"
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly_day"
  | "monthly_weekday"
  | "yearly";

export interface RepeatPreset {
  id: RepeatPresetId;
  value: RepeatValue;
  label: string;
}

export const WEEKDAY_CODES = [
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
  "SU",
] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

const FREQ: Record<Exclude<Repeat, "never">, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

interface Anchor {
  year: number;
  month: number;
  day: number;
  weekday: WeekdayCode;
  /** Which occurrence of its weekday in the month: 1–4, or -1 for the last one. */
  nth: number;
}

function anchorOf(date: string): Anchor {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1, day));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    day,
    weekday: WEEKDAY_CODES[(utc.getUTCDay() + 6) % 7]!,
    nth: day + 7 > daysInMonth ? -1 : Math.ceil(day / 7),
  };
}

function dayName(code: WeekdayCode, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: style,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 5 + WEEKDAY_CODES.indexOf(code))));
}

export function weekdayShortName(code: WeekdayCode): string {
  return dayName(code, "short");
}

function ordinalDay(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${{ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th"}`;
}

export function nthWord(nth: number): string {
  return (
    { 1: "first", 2: "second", 3: "third", 4: "fourth", [-1]: "last" }[nth] ??
    "last"
  );
}

function shortDate(month: number, day: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, month - 1, day)));
}

/** The everyday choices, worked out from the date the series starts on (#154). */
export function repeatPresets(anchorDate: string): RepeatPreset[] {
  const a = anchorOf(anchorDate);
  const day = dayName(a.weekday);
  const presets: [RepeatPresetId, RepeatValue, string][] = [
    ["never", { repeat: "never", repeat_rule: null }, t("repeat_preset.never")],
    ["daily", { repeat: "daily", repeat_rule: null }, t("repeat_preset.daily")],
    [
      "weekdays",
      { repeat: "weekly", repeat_rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
      t("repeat_preset.weekdays"),
    ],
    [
      "weekly",
      { repeat: "weekly", repeat_rule: `FREQ=WEEKLY;BYDAY=${a.weekday}` },
      t("repeat_preset.weekly", { day }),
    ],
    [
      "biweekly",
      {
        repeat: "weekly",
        repeat_rule: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${a.weekday}`,
      },
      t("repeat_preset.biweekly", { day }),
    ],
    [
      "monthly_day",
      { repeat: "monthly", repeat_rule: `FREQ=MONTHLY;BYMONTHDAY=${a.day}` },
      t("repeat_preset.monthly_day", { ordinal_day: ordinalDay(a.day) }),
    ],
    [
      "monthly_weekday",
      {
        repeat: "monthly",
        repeat_rule: `FREQ=MONTHLY;BYDAY=${a.nth}${a.weekday}`,
      },
      t("repeat_preset.monthly_weekday", { nth: nthWord(a.nth), day }),
    ],
    [
      "yearly",
      {
        repeat: "yearly",
        repeat_rule: `FREQ=YEARLY;BYMONTH=${a.month};BYMONTHDAY=${a.day}`,
      },
      t("repeat_preset.yearly", { date: shortDate(a.month, a.day) }),
    ],
  ];
  return presets.map(([id, value, label]) => ({ id, value, label }));
}

/** The preset a stored repeat matches, else "custom". A bare frequency counts as its preset. */
export function presetIdFor(
  value: RepeatValue,
  anchorDate: string,
): RepeatPresetId | "custom" {
  if (value.repeat === "never") return "never";
  if (value.repeat_rule === null || value.repeat_rule === "") {
    return (
      {
        daily: "daily",
        weekly: "weekly",
        monthly: "monthly_day",
        yearly: "yearly",
      } as const
    )[value.repeat];
  }
  const match = repeatPresets(anchorDate).find(
    (preset) =>
      preset.value.repeat === value.repeat &&
      preset.value.repeat_rule === value.repeat_rule,
  );
  return match ? match.id : "custom";
}

export type RepeatEnd =
  | { kind: "never" }
  | { kind: "on"; date: string }
  | { kind: "after"; count: number };

/** What the Custom repeat dialog edits. */
export interface CustomRepeat {
  frequency: Exclude<Repeat, "never">;
  interval: number;
  /** Weekly: the days it repeats on. */
  days: WeekdayCode[];
  /** Monthly: on the same day number, or on the same nth weekday. */
  monthMode: "day" | "weekday";
  end: RepeatEnd;
}

export function defaultCustom(anchorDate: string): CustomRepeat {
  const a = anchorOf(anchorDate);
  return {
    frequency: "weekly",
    interval: 1,
    days: [a.weekday],
    monthMode: "day",
    end: { kind: "never" },
  };
}

/** Builds the stored value. Only rule parts the server accepts: FREQ, INTERVAL, BYDAY, BYMONTHDAY, BYMONTH, COUNT, UNTIL. */
export function buildRule(
  custom: CustomRepeat,
  anchorDate: string,
): RepeatValue {
  const a = anchorOf(anchorDate);
  const parts = [`FREQ=${FREQ[custom.frequency]}`];
  const interval = Math.min(999, Math.max(1, Math.round(custom.interval)));
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (custom.frequency === "weekly") {
    const days = WEEKDAY_CODES.filter((code) => custom.days.includes(code));
    parts.push(`BYDAY=${(days.length ? days : [a.weekday]).join(",")}`);
  } else if (custom.frequency === "monthly") {
    parts.push(
      custom.monthMode === "weekday"
        ? `BYDAY=${a.nth}${a.weekday}`
        : `BYMONTHDAY=${a.day}`,
    );
  } else if (custom.frequency === "yearly") {
    parts.push(`BYMONTH=${a.month}`, `BYMONTHDAY=${a.day}`);
  }
  if (custom.end.kind === "on" && custom.end.date) {
    // The server's RRULE library needs a UTC time with UNTIL: the end of that day keeps it in
    parts.push(`UNTIL=${custom.end.date.replaceAll("-", "")}T235959Z`);
  } else if (custom.end.kind === "after") {
    parts.push(
      `COUNT=${Math.min(1000, Math.max(1, Math.round(custom.end.count)))}`,
    );
  }
  return { repeat: custom.frequency, repeat_rule: parts.join(";") };
}

/** Reads a stored value back into the dialog; anything it doesn't know starts from the defaults. */
export function parseRule(
  value: RepeatValue,
  anchorDate: string,
): CustomRepeat {
  const custom = defaultCustom(anchorDate);
  if (value.repeat === "never") return custom;
  custom.frequency = value.repeat;
  const parts = Object.fromEntries(
    (value.repeat_rule ?? "")
      .split(";")
      .map((part) => part.split("=") as [string, string])
      .filter(([key, val]) => key && val),
  );
  if (parts.INTERVAL) custom.interval = Number(parts.INTERVAL) || 1;
  if (value.repeat === "weekly" && parts.BYDAY) {
    const days = parts.BYDAY.split(",").filter((code): code is WeekdayCode =>
      (WEEKDAY_CODES as readonly string[]).includes(code),
    );
    if (days.length) custom.days = days;
  }
  if (value.repeat === "monthly" && parts.BYDAY) custom.monthMode = "weekday";
  if (parts.COUNT) custom.end = { kind: "after", count: Number(parts.COUNT) };
  else if (parts.UNTIL && /^\d{8}/.test(parts.UNTIL)) {
    const d = parts.UNTIL.slice(0, 8);
    custom.end = {
      kind: "on",
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
    };
  }
  return custom;
}

/** The weekdays in the order the user's week starts. */
export function orderedWeekdays(weekStart: WeekStart): WeekdayCode[] {
  return weekStart === "sun"
    ? ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
    : [...WEEKDAY_CODES];
}

export function monthModeLabels(anchorDate: string): {
  day: string;
  weekday: string;
} {
  const a = anchorOf(anchorDate);
  return {
    day: t("repeat_custom.month_day", { day: String(a.day) }),
    weekday: t("repeat_custom.month_weekday", {
      nth: nthWord(a.nth),
      day: dayName(a.weekday),
    }),
  };
}
