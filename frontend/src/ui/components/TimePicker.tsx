import { useWideScreen } from "./useMediaQuery";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { t } from "../copy";
import { formatTime } from "../domain/dates";
import type { TimeFormat } from "../domain/types";
import { ClockPicker } from "./ClockPicker";
import { cx } from "./cx";
import { CheckIcon } from "./icons";
import { PickerTrigger } from "./PickerTrigger";
import { PopoverOrSheet } from "./PopoverOrSheet";
import type { PickerVariant } from "./usePickerKeyboard";

export interface TimePickerProps {
  id?: string;
  label: string;
  /** "HH:MM", or "" for none. */
  value: string;
  onChange: (time: string) => void;
  timeFormat: TimeFormat;
  /** Times at or before this one are not offered (the due time on the start day). */
  minTime?: string | null;
  disabled?: boolean;
  variant?: PickerVariant;
  ariaDescribedBy?: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The hour and minute boxes for a time, in the clock the user reads (12- or 24-hour). */
function boxesFor(time: string, twelve: boolean) {
  if (!time) return { hour: "", minute: "", pm: false };
  const h = Number(time.slice(0, 2));
  return {
    hour: pad(twelve ? (h % 12 === 0 ? 12 : h % 12) : h),
    minute: time.slice(3, 5),
    pm: h >= 12,
  };
}

/**
 * Start and due time (#154). From 768px a popover with a fixed HH : MM field (the colon is part
 * of the field, so only digits go in) over the quarter-hour list; on a phone a sheet with a
 * clock face.
 */
export function TimePicker({
  id,
  label,
  value,
  onChange,
  timeFormat,
  minTime = null,
  disabled = false,
  variant = "panel",
  ariaDescribedBy,
  className,
}: TimePickerProps): ReactElement {
  const autoId = useId();
  const pickerId = id ?? `time-${autoId}`;
  const listId = `${pickerId}-list`;
  const errorId = `${pickerId}-error`;
  const twelve = timeFormat === "12h";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [pm, setPm] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isWide = useWideScreen();
  const isScreen = variant === "screen" || variant === "row";

  const allowed = (time: string) => minTime === null || time > minTime;

  // None, then the quarter hours (plus the current value) after the minimum
  const times: string[] = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 15) times.push(`${pad(h)}:${pad(m)}`);
  if (value && !times.includes(value)) times.push(value);
  times.sort();
  const options = [
    { value: "", label: t("task.not_set") },
    ...times
      .filter(allowed)
      .map((time) => ({ value: time, label: formatTime(time, timeFormat) })),
  ];

  // The popover is placed (and made visible) a frame after it mounts, and a hidden field can't
  // take focus: keep trying for a few frames so typing goes straight into the hour
  useEffect(() => {
    if (!open || !isWide) return;
    let tries = 20;
    let frame = 0;
    const focus = () => {
      const field = hourRef.current;
      field?.focus();
      if (document.activeElement === field) field?.select();
      else if (tries-- > 0) frame = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [open, isWide]);

  const show = (time: string) => {
    const boxes = boxesFor(time, twelve);
    setHour(boxes.hour);
    setMinute(boxes.minute);
    setPm(boxes.pm);
  };

  const close = () => {
    setOpen(false);
    setError(null);
  };
  const choose = (time: string) => {
    onChange(time);
    close();
    triggerRef.current?.focus();
  };

  // What the boxes hold, as "HH:MM", or why it isn't a time
  const typedTime = (): { time: string } | { error: string } => {
    const h = Number(hour);
    const m = minute === "" ? 0 : Number(minute);
    const validHour = twelve ? h >= 1 && h <= 12 : h >= 0 && h <= 23;
    if (hour === "" || !validHour || m > 59)
      return { error: t("time.invalid") };
    const h24 = twelve ? (h % 12) + (pm ? 12 : 0) : h;
    const time = `${pad(h24)}:${pad(m)}`;
    if (!allowed(time))
      return {
        error: t("time.after", { time: formatTime(minTime!, timeFormat) }),
      };
    return { time };
  };

  const confirm = () => {
    if (hour === "" && minute === "") return choose("");
    const typed = typedTime();
    if ("error" in typed) setError(typed.error);
    else choose(typed.time);
  };

  const onFieldKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    box: "hour" | "minute",
  ) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // Arrows walk the list and the boxes show the time they are on
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (active + step + options.length) % options.length;
      setActive(next);
      show(options[next]!.value);
      setError(null);
    } else if (event.key === "Enter") {
      event.preventDefault();
      confirm();
    } else if (box === "minute" && event.key === "Backspace" && minute === "") {
      // Backspace past the start of the minutes goes back to the hour
      event.preventDefault();
      hourRef.current?.focus();
    }
  };

  const onHourChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(-2);
    setHour(digits);
    setError(null);
    // Two digits, or one that can't start a longer hour, and on to the minutes
    if (digits.length === 2 || Number(digits) > (twelve ? 1 : 2)) {
      minuteRef.current?.focus();
      minuteRef.current?.select();
    }
  };

  const selected = value ? formatTime(value, timeFormat) : t("task.not_set");
  const box =
    "h-9 w-9 border-0 bg-transparent p-0 text-center text-body font-semibold tabular-nums text-ink outline-none placeholder:text-ink-tertiary";

  return (
    <div className={cx("inline-flex flex-col", className)}>
      <PopoverOrSheet
        open={open}
        onClose={close}
        label={label}
        triggerRef={triggerRef}
        align={isScreen ? "right" : "left"}
        popoverClassName="w-[240px] p-0"
        trigger={
          <PickerTrigger
            triggerRef={triggerRef}
            id={pickerId}
            label={label}
            haspopup="dialog"
            open={open}
            describedBy={ariaDescribedBy}
            disabled={disabled}
            isScreen={isScreen}
            onToggle={() => {
              if (open) return close();
              show(value);
              // Start the list on the time already set
              setActive(
                Math.max(
                  0,
                  options.findIndex((o) => o.value === value),
                ),
              );
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && !open) {
                event.preventDefault();
                show(value);
                setOpen(true);
              }
            }}
          >
            {selected}
          </PickerTrigger>
        }
      >
        {isWide ? (
          <div className="flex max-h-[min(380px,calc(100vh-16px))] flex-col">
            <div className="border-b border-separator p-2">
              <div
                role="group"
                aria-label={t("time.field")}
                aria-describedby={error ? errorId : undefined}
                className={cx(
                  "flex h-11 items-center gap-1 rounded-field border bg-surface px-2 focus-within:ring-2 focus-within:ring-primary/40",
                  error ? "border-error" : "border-control",
                )}
              >
                <input
                  ref={hourRef}
                  aria-label={t("time.hour")}
                  aria-controls={listId}
                  aria-invalid={error ? true : undefined}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="HH"
                  maxLength={3}
                  value={hour}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => onHourChange(event.target.value)}
                  onKeyDown={(event) => onFieldKeyDown(event, "hour")}
                  className={box}
                />
                <span
                  aria-hidden="true"
                  className="text-body font-semibold text-ink-secondary"
                >
                  :
                </span>
                <input
                  ref={minuteRef}
                  aria-label={t("time.minute")}
                  aria-controls={listId}
                  aria-invalid={error ? true : undefined}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="MM"
                  maxLength={3}
                  value={minute}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => {
                    setMinute(event.target.value.replace(/\D/g, "").slice(-2));
                    setError(null);
                  }}
                  onKeyDown={(event) => onFieldKeyDown(event, "minute")}
                  className={box}
                />
                {twelve && (
                  <button
                    type="button"
                    aria-label={t(pm ? "time.pm" : "time.am")}
                    onClick={() => {
                      setPm((v) => !v);
                      setError(null);
                    }}
                    className="focus-ring ml-auto min-h-8 cursor-pointer rounded-full border-0 bg-fill px-2.5 text-footnote font-semibold text-ink"
                  >
                    {t(pm ? "time.pm" : "time.am")}
                  </button>
                )}
              </div>
              {error && (
                <p
                  id={errorId}
                  role="alert"
                  className="m-0 mt-1.5 text-footnote text-error"
                >
                  {error}
                </p>
              )}
            </div>
            <div
              id={listId}
              role="listbox"
              aria-label={label}
              className="flex flex-col gap-0.5 overflow-y-auto p-1"
            >
              {options.map((option, index) => (
                <div
                  key={option.value || "none"}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  ref={(el) => {
                    if (el && index === active)
                      el.scrollIntoView?.({ block: "nearest" });
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    // The boxes show what was picked as the picker closes
                    show(option.value);
                    choose(option.value);
                  }}
                  className={cx(
                    "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-field px-3 text-body text-ink hover:bg-fill",
                    index === active && "bg-fill",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <span className="shrink-0 text-primary">
                      <CheckIcon size={18} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ClockPicker
            value={value}
            timeFormat={timeFormat}
            minTime={minTime}
            onDone={choose}
            onCancel={close}
          />
        )}
      </PopoverOrSheet>
    </div>
  );
}
