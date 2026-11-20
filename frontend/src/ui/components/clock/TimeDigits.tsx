import { t } from "../../copy";
import { cx } from "../cx";
import type { DialMode } from "./clockFace";

const DIGITS = "h-16 w-20 rounded-box text-[2.5rem] font-medium tabular-nums";

function Colon() {
  return (
    <span className="text-[2.5rem] text-ink" aria-hidden="true">
      :
    </span>
  );
}

/** The big hour and minute over the dial: which one the dial sets is filled. */
export function TimeDigits({
  hour,
  minute,
  mode,
  onMode,
}: {
  hour: string;
  minute: string;
  mode: DialMode;
  onMode: (mode: DialMode) => void;
}) {
  const part = (which: DialMode, text: string) => (
    <button
      type="button"
      aria-label={t(which === "hour" ? "time.hour" : "time.minute")}
      aria-pressed={mode === which}
      className={cx(
        "focus-ring flex cursor-pointer items-center justify-center border-0",
        DIGITS,
        mode === which ? "bg-ink text-paper" : "bg-fill text-ink",
      )}
      onClick={() => onMode(which)}
    >
      {text}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      {part("hour", hour)}
      <Colon />
      {part("minute", minute)}
    </div>
  );
}

/** The same two boxes as fields, for typing the time instead. */
export function TimeDigitFields({
  hour,
  minute,
  onHour,
  onMinute,
}: {
  hour: string;
  minute: string;
  onHour: (digits: string) => void;
  onMinute: (digits: string) => void;
}) {
  const field = (
    label: string,
    value: string,
    onChange: (digits: string) => void,
    autoFocus = false,
  ) => (
    <input
      aria-label={label}
      inputMode="numeric"
      autoFocus={autoFocus}
      maxLength={2}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className={cx(
        "field-ring border border-control bg-surface text-center text-ink",
        DIGITS,
      )}
    />
  );
  return (
    <div className="flex items-center gap-2">
      {field(t("time.hour"), hour, onHour, true)}
      <Colon />
      {field(t("time.minute"), minute, onMinute)}
    </div>
  );
}
