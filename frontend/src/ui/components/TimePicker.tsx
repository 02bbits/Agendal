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
import {
  boxesFor,
  hourIsComplete,
  lastTwoDigits,
  timeOptions,
  typedTime,
} from "./clock/timeOptions";
import { TimeOptionList } from "./clock/TimeOptionList";
import { TypedTimeField } from "./clock/TypedTimeField";
import { cx } from "./cx";
import { PickerTrigger } from "./PickerTrigger";
import { PopoverOrSheet } from "./PopoverOrSheet";
import { useWideScreen } from "./useMediaQuery";
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

/** The popover appears a frame after it mounts; the hour field gets this many frames to take focus. */
const FOCUS_TRIES = 20;

/**
 * Start and due time (#154). From 768px a popover with a fixed HH : MM field over the
 * quarter-hour list; on a phone a sheet with a clock face.
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
  const options = timeOptions(value, minTime, timeFormat);

  // A hidden field can't take focus: keep trying for a few frames so typing goes straight into
  // the hour
  useEffect(() => {
    if (!open || !isWide) return;
    let tries = FOCUS_TRIES;
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

  /** The boxes show this time. */
  const show = (time: string) => {
    const boxes = boxesFor(time, twelve);
    setHour(boxes.hour);
    setMinute(boxes.minute);
    setPm(boxes.pm);
  };

  const openPicker = () => {
    show(value);
    // Start the list on the time already set
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const closeAndCommit = () => {
    // Clicking outside after typing a valid time (e.g. 01:07) saves it instead of discarding
    if (hour !== "" || minute !== "") {
      const typed = typedTime({
        hour,
        minute,
        pm,
        twelve,
        minTime,
        timeFormat,
      });
      if ("time" in typed && typed.time !== value) {
        onChange(typed.time);
      }
    }
    close();
  };

  const choose = (time: string) => {
    onChange(time);
    close();
    triggerRef.current?.focus();
  };

  const confirm = () => {
    if (hour === "" && minute === "") return choose("");
    const typed = typedTime({ hour, minute, pm, twelve, minTime, timeFormat });
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
    } else if (event.key === "Escape") {
      event.stopPropagation();
      close();
    } else if (box === "minute" && event.key === "Backspace" && minute === "") {
      // Backspace past the start of the minutes goes back to the hour
      event.preventDefault();
      hourRef.current?.focus();
    }
  };

  const onHour = (raw: string) => {
    const digits = lastTwoDigits(raw);
    setHour(digits);
    setError(null);
    if (!hourIsComplete(digits, twelve)) return;
    minuteRef.current?.focus();
    minuteRef.current?.select();
  };

  return (
    <div className={cx("inline-flex flex-col", className)}>
      <PopoverOrSheet
        open={open}
        onClose={isWide ? closeAndCommit : close}
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
            onToggle={() => (open ? close() : openPicker())}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && !open) {
                event.preventDefault();
                show(value);
                setOpen(true);
              }
            }}
          >
            {value ? formatTime(value, timeFormat) : t("task.not_set")}
          </PickerTrigger>
        }
      >
        {isWide ? (
          <div className="flex max-h-[min(380px,calc(100vh-16px))] flex-col">
            <TypedTimeField
              hourRef={hourRef}
              minuteRef={minuteRef}
              hour={hour}
              minute={minute}
              pm={pm}
              twelve={twelve}
              error={error}
              errorId={`${pickerId}-error`}
              listId={listId}
              onHour={onHour}
              onMinute={(raw) => {
                setMinute(lastTwoDigits(raw));
                setError(null);
              }}
              onTogglePm={() => {
                setPm((was) => !was);
                setError(null);
              }}
              onConfirm={confirm}
              onKeyDown={onFieldKeyDown}
            />
            <TimeOptionList
              id={listId}
              label={label}
              options={options}
              value={value}
              active={active}
              onPick={(time) => {
                // The boxes show what was picked as the picker closes
                show(time);
                choose(time);
              }}
            />
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
