import { t } from "../../copy";
import { formatTime } from "../../domain/dates";
import type { TimeFormat } from "../../domain/types";
import { pad, shownHourOf } from "./clockFace";

/** The list offers every quarter hour. */
const STEP_MINUTES = 15;

/**
 * None, then the quarter hours after the minimum, with the current value among them even when
 * it isn't on a quarter.
 */
export function timeOptions(
  value: string,
  minTime: string | null,
  timeFormat: TimeFormat,
): Array<{ value: string; label: string }> {
  const times: string[] = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += STEP_MINUTES)
      times.push(`${pad(h)}:${pad(m)}`);
  if (value && !times.includes(value)) times.push(value);
  return [
    { value: "", label: t("task.not_set") },
    ...times
      .sort()
      .filter((time) => minTime === null || time > minTime)
      .map((time) => ({ value: time, label: formatTime(time, timeFormat) })),
  ];
}

/** The hour and minute boxes for a time, in the clock the user reads (12- or 24-hour). */
export function boxesFor(time: string, twelve: boolean) {
  if (!time) return { hour: "", minute: "", pm: false };
  const h = Number(time.slice(0, 2));
  return {
    hour: pad(shownHourOf(h, twelve)),
    minute: time.slice(3, 5),
    pm: h >= 12,
  };
}

/** What the boxes hold, as "HH:MM", or why it isn't a time the picker takes. */
export function typedTime({
  hour,
  minute,
  pm,
  twelve,
  minTime,
  timeFormat,
}: {
  hour: string;
  minute: string;
  pm: boolean;
  twelve: boolean;
  minTime: string | null;
  timeFormat: TimeFormat;
}): { time: string } | { error: string } {
  const h = Number(hour);
  const m = minute === "" ? 0 : Number(minute);
  const validHour = twelve ? h >= 1 && h <= 12 : h >= 0 && h <= 23;
  if (hour === "" || !validHour || m > 59) return { error: t("time.invalid") };
  const time = `${pad(twelve ? (h % 12) + (pm ? 12 : 0) : h)}:${pad(m)}`;
  if (minTime !== null && time <= minTime)
    return {
      error: t("time.after", { time: formatTime(minTime, timeFormat) }),
    };
  return { time };
}

/** Typing the hour: two digits, or one that can't start a longer hour, moves on to the minutes. */
export const hourIsComplete = (digits: string, twelve: boolean) =>
  digits.length === 2 || Number(digits) > (twelve ? 1 : 2);

/** Only the last two digits typed. */
export const lastTwoDigits = (raw: string) => raw.replace(/\D/g, "").slice(-2);
