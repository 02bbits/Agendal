import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from "react";
import { t } from "../copy";
import type { TimeFormat } from "../domain/types";
import { formatTime } from "../domain/dates";
import { parseTime } from "../domain/parseTime";
import { cx } from "./cx";

export interface ClockPickerProps {
  /** "HH:MM", or "" for no time yet. */
  value: string;
  timeFormat: TimeFormat;
  /** Times at or before this one are refused (the due time on the start day). */
  minTime?: string | null;
  onDone: (time: string) => void;
  onCancel: () => void;
}

const SIZE = 256;
const CENTER = SIZE / 2;
const OUTER = 104;
const INNER = 68;
const pad = (n: number) => String(n).padStart(2, "0");

/** Where the i-th of 12 marks sits on a ring, 0 at the top, clockwise. */
function spot(i: number, radius: number) {
  const angle = (i / 12) * 2 * Math.PI;
  return {
    x: CENTER + radius * Math.sin(angle),
    y: CENTER - radius * Math.cos(angle),
  };
}

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
  const start = value || "09:00";
  const [hour, setHour] = useState(Number(start.slice(0, 2)));
  const [minute, setMinute] = useState(Number(start.slice(3, 5)));
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const [typing, setTyping] = useState(false);
  const [typedHour, setTypedHour] = useState(pad(hour));
  const [typedMinute, setTypedMinute] = useState(pad(minute));
  const [error, setError] = useState<string | null>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const twelve = timeFormat === "12h";
  const pm = hour >= 12;

  const shownHour = twelve ? (hour % 12 === 0 ? 12 : hour % 12) : hour;

  const pick = (clientX: number, clientY: number, final: boolean) => {
    const box = dialRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = clientX - box.left - (box.width / SIZE) * CENTER;
    const y = clientY - box.top - (box.height / SIZE) * CENTER;
    const scale = box.width / SIZE;
    const distance = Math.hypot(x, y) / scale;
    // 0 at the top, clockwise, in turns
    const turn = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1;
    setError(null);
    if (mode === "hour") {
      const index = Math.round(turn * 12) % 12;
      if (twelve) setHour((pm ? 12 : 0) + index);
      else setHour(distance < (OUTER + INNER) / 2 ? index + 12 : index);
      if (final) setMode("minute");
    } else {
      setMinute(Math.round(turn * 60) % 60);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pick(event.clientX, event.clientY, false);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) pick(event.clientX, event.clientY, false);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    pick(event.clientX, event.clientY, true);
  };

  // Arrow keys move the hand one step, Enter on the hour goes on to the minute
  const onDialKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step) {
      event.preventDefault();
      setError(null);
      if (mode === "hour") setHour((h) => (h + step + 24) % 24);
      else setMinute((m) => (m + step + 60) % 60);
    } else if (event.key === "Enter" && mode === "hour") {
      event.preventDefault();
      setMode("minute");
    }
  };

  const confirm = () => {
    let time = `${pad(hour)}:${pad(minute)}`;
    if (typing) {
      const typed = parseTime(
        `${typedHour}:${typedMinute || "00"}${twelve ? (pm ? "pm" : "am") : ""}`,
      );
      if (!typed) {
        setError(t("time.invalid"));
        return;
      }
      time = typed;
    }
    if (minTime && time <= minTime) {
      setError(t("time.after", { time: formatTime(minTime, timeFormat) }));
      return;
    }
    onDone(time);
  };

  const hand = (() => {
    if (mode === "minute") return spot(minute / 5, OUTER);
    const index = hour % 12;
    return spot(index, !twelve && hour >= 12 ? INNER : OUTER);
  })();

  const marks =
    mode === "minute"
      ? Array.from({ length: 12 }, (_, i) => ({
          label: pad(i * 5),
          value: i * 5,
          ring: OUTER,
          index: i,
        }))
      : [
          ...Array.from({ length: 12 }, (_, i) => ({
            label: String(twelve ? (i === 0 ? 12 : i) : i),
            value: twelve ? (pm ? 12 : 0) + i : i,
            ring: OUTER,
            index: i,
          })),
          ...(twelve
            ? []
            : Array.from({ length: 12 }, (_, i) => ({
                label: String(i + 12),
                value: i + 12,
                ring: INNER,
                index: i,
              }))),
        ];
  const selected = mode === "minute" ? minute : hour;

  const box = (active: boolean) =>
    cx(
      "focus-ring flex h-16 w-20 cursor-pointer items-center justify-center rounded-box border-0 text-[2.5rem] font-medium tabular-nums",
      active ? "bg-ink text-paper" : "bg-fill text-ink",
    );

  return (
    <div className="flex flex-col items-center gap-5 pb-1">
      {typing ? (
        <div className="flex items-center gap-2">
          <input
            aria-label={t("time.hour")}
            inputMode="numeric"
            autoFocus
            maxLength={2}
            value={typedHour}
            onChange={(e) => {
              setError(null);
              setTypedHour(e.target.value.replace(/\D/g, ""));
            }}
            className="field-ring h-16 w-20 rounded-box border border-control bg-surface text-center text-[2.5rem] font-medium tabular-nums text-ink"
          />
          <span className="text-[2.5rem] text-ink" aria-hidden="true">
            :
          </span>
          <input
            aria-label={t("time.minute")}
            inputMode="numeric"
            maxLength={2}
            value={typedMinute}
            onChange={(e) => {
              setError(null);
              setTypedMinute(e.target.value.replace(/\D/g, ""));
            }}
            className="field-ring h-16 w-20 rounded-box border border-control bg-surface text-center text-[2.5rem] font-medium tabular-nums text-ink"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("time.hour")}
            aria-pressed={mode === "hour"}
            className={box(mode === "hour")}
            onClick={() => setMode("hour")}
          >
            {pad(shownHour)}
          </button>
          <span className="text-[2.5rem] text-ink" aria-hidden="true">
            :
          </span>
          <button
            type="button"
            aria-label={t("time.minute")}
            aria-pressed={mode === "minute"}
            className={box(mode === "minute")}
            onClick={() => setMode("minute")}
          >
            {pad(minute)}
          </button>
        </div>
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
                onClick={() => {
                  setError(null);
                  setHour((h) => (h % 12) + (half === "pm" ? 12 : 0));
                }}
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
        <div
          ref={dialRef}
          role="slider"
          tabIndex={0}
          aria-label={t(mode === "hour" ? "time.hour" : "time.minute")}
          aria-valuemin={0}
          aria-valuemax={mode === "hour" ? 23 : 59}
          aria-valuenow={selected}
          aria-valuetext={mode === "hour" ? String(shownHour) : pad(minute)}
          onKeyDown={onDialKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragging.current = false)}
          className="focus-ring relative aspect-square w-full max-w-[256px] touch-none select-none rounded-full bg-fill"
        >
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="absolute inset-0 size-full text-ink"
            aria-hidden="true"
          >
            <line
              x1={CENTER}
              y1={CENTER}
              x2={hand.x}
              y2={hand.y}
              stroke="currentColor"
              strokeWidth={2}
            />
            <circle cx={CENTER} cy={CENTER} r={4} fill="currentColor" />
            <circle cx={hand.x} cy={hand.y} r={18} fill="currentColor" />
          </svg>
          {marks.map((mark) => {
            const at = spot(mark.index, mark.ring);
            const on = mark.value === selected;
            return (
              <span
                key={`${mark.ring}-${mark.label}`}
                aria-hidden="true"
                style={{
                  left: `${(at.x / SIZE) * 100}%`,
                  top: `${(at.y / SIZE) * 100}%`,
                }}
                className={cx(
                  "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 tabular-nums",
                  mark.ring === INNER ? "text-footnote" : "text-body",
                  on
                    ? "font-semibold text-paper"
                    : mark.ring === INNER
                      ? "text-ink-secondary"
                      : "text-ink",
                )}
              >
                {mark.label}
              </span>
            );
          })}
        </div>
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
          onClick={() => {
            setError(null);
            if (!typing) {
              setTypedHour(pad(shownHour));
              setTypedMinute(pad(minute));
            }
            setTyping((v) => !v);
          }}
          className="focus-ring inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary hover:bg-fill"
        >
          {typing ? (
            <svg
              viewBox="0 0 24 24"
              width={22}
              height={22}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width={22}
              height={22}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <path
                d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring min-h-11 cursor-pointer rounded-field border-0 bg-transparent px-3 text-callout font-semibold text-ink hover:bg-fill"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          className="focus-ring min-h-11 cursor-pointer rounded-field border-0 bg-transparent px-3 text-callout font-semibold text-primary hover:bg-fill"
        >
          {t("common.ok")}
        </button>
      </div>
    </div>
  );
}
