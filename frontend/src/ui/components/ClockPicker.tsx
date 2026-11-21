import { useState, type ReactElement } from "react";
import { t } from "../copy";
import { formatTime } from "../domain/dates";
import { parseTime } from "../domain/parseTime";
import type { TimeFormat } from "../domain/types";
import { ClockDial } from "./clock/ClockDial";
import {
  hourAt,
  minuteAt,
  pad,
  shownHourOf,
  type DialMode,
} from "./clock/clockFace";
import { TimeDigitFields, TimeDigits } from "./clock/TimeDigits";
import { cx } from "./cx";
import { ClockIcon, KeyboardIcon } from "./icons";

export interface ClockPickerProps {
  /** "HH:MM", or "" for no time yet. */
  value: string;
  timeFormat: TimeFormat;
  /** Times at or before this one are refused (the due time on the start day). */
  minTime?: string | null;
  onDone: (time: string) => void;
  onCancel: () => void;
}

/** Where the clock starts when there is no time yet. */
const DEFAULT_TIME = "09:00";
const TEXT_BUTTON =
  "focus-ring min-h-11 cursor-pointer rounded-field border-0 bg-transparent px-3 text-callout font-semibold hover:bg-fill";

/**
 * A clock-face time picker for phones (#154): tap or drag the hour, then the minute; the
 * keyboard button switches to typing. 24-hour shows 0–11 outside and 12–23 inside; 12-hour
 * shows 1–12 with AM/PM.
 */
export function ClockPicker({
  value,
  timeFormat,
  minTime = null,
  onDone,
  onCancel,
}: ClockPickerProps): ReactElement {
  const start = value || DEFAULT_TIME;
  const [hour, setHour] = useState(Number(start.slice(0, 2)));
  const [minute, setMinute] = useState(Number(start.slice(3, 5)));
  const [mode, setMode] = useState<DialMode>("hour");
  const [typing, setTyping] = useState(false);
  const [typedHour, setTypedHour] = useState(pad(hour));
  const [typedMinute, setTypedMinute] = useState(pad(minute));
  const [error, setError] = useState<string | null>(null);
  const twelve = timeFormat === "12h";
  const pm = hour >= 12;
  const shownHour = shownHourOf(hour, twelve);

  /** Any change clears the last error. */
  const edit =
    <A extends unknown[]>(change: (...args: A) => void) =>
    (...args: A) => {
      setError(null);
      change(...args);
    };

  const onPoint = edit((turn: number, distance: number, final: boolean) => {
    if (mode === "minute") {
      setMinute(minuteAt(turn));
      return;
    }
    setHour(hourAt(turn, distance, twelve, pm));
    if (final) setMode("minute");
  });

  const onStep = edit((step: 1 | -1) => {
    if (mode === "hour") setHour((h) => (h + step + 24) % 24);
    else setMinute((m) => (m + step + 60) % 60);
  });

  /** The typed time, or the dial's; null and an error when it can't be used. */
  const chosenTime = (): string | null => {
    let time = `${pad(hour)}:${pad(minute)}`;
    if (typing) {
      const half = twelve ? (pm ? "pm" : "am") : "";
      const typed = parseTime(`${typedHour}:${typedMinute || "00"}${half}`);
      if (!typed) {
        setError(t("time.invalid"));
        return null;
      }
      time = typed;
    }
    if (minTime && time <= minTime) {
      setError(t("time.after", { time: formatTime(minTime, timeFormat) }));
      return null;
    }
    return time;
  };

  const switchInput = edit(() => {
    if (!typing) {
      setTypedHour(pad(shownHour));
      setTypedMinute(pad(minute));
    }
    setTyping((was) => !was);
  });

  return (
    <div className="flex flex-col items-center gap-5 pb-1">
      {typing ? (
        <TimeDigitFields
          hour={typedHour}
          minute={typedMinute}
          onHour={edit(setTypedHour)}
          onMinute={edit(setTypedMinute)}
        />
      ) : (
        <TimeDigits
          hour={pad(shownHour)}
          minute={pad(minute)}
          mode={mode}
          onMode={setMode}
        />
      )}

      {twelve && (
        <div className="flex gap-1 rounded-full bg-fill p-1">
          {(["am", "pm"] as const).map((half) => {
            const on = half === "pm" ? pm : !pm;
            return (
              <button
                key={half}
                type="button"
                aria-pressed={on}
                onClick={edit(() =>
                  setHour((h) => (h % 12) + (half === "pm" ? 12 : 0)),
                )}
                className={cx(
                  "focus-ring min-h-9 cursor-pointer rounded-full border-0 px-4 text-footnote font-semibold",
                  on
                    ? "bg-surface text-ink shadow-xs"
                    : "bg-transparent text-ink-secondary",
                )}
              >
                {t(half === "am" ? "time.am" : "time.pm")}
              </button>
            );
          })}
        </div>
      )}

      {!typing && (
        <ClockDial
          mode={mode}
          hour={hour}
          minute={minute}
          twelve={twelve}
          onPoint={onPoint}
          onStep={onStep}
          onNext={() => setMode("minute")}
        />
      )}

      {error && (
        <p role="alert" className="m-0 text-footnote text-error">
          {error}
        </p>
      )}

      <div className="flex w-full items-center gap-1">
        <button
          type="button"
          aria-label={t(typing ? "time.dial" : "time.keyboard")}
          onClick={switchInput}
          className="focus-ring inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary hover:bg-fill"
        >
          {typing ? <ClockIcon size={22} /> : <KeyboardIcon size={22} />}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className={cx(TEXT_BUTTON, "text-ink")}
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => {
            const time = chosenTime();
            if (time) onDone(time);
          }}
          className={cx(TEXT_BUTTON, "text-primary")}
        >
          {t("common.ok")}
        </button>
      </div>
    </div>
  );
}
