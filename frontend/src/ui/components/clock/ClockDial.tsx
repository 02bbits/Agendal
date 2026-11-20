import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { t } from "../../copy";
import { cx } from "../cx";
import {
  CENTER,
  dialMarks,
  handSpot,
  INNER,
  pad,
  pointOnDial,
  shownHourOf,
  SIZE,
  spot,
  type DialMode,
} from "./clockFace";

/** Size of the dot at the hand's end and the centre pin. */
const HAND_END_R = 18;
const PIN_R = 4;

/**
 * The clock face: tap or drag to the hour or minute, arrow keys to step, Enter on the hour to go
 * on to the minute. A slider for screen readers.
 */
export function ClockDial({
  mode,
  hour,
  minute,
  twelve,
  onPoint,
  onStep,
  onNext,
}: {
  mode: DialMode;
  hour: number;
  minute: number;
  twelve: boolean;
  /** A point on the dial; `final` when the finger lifts. */
  onPoint: (turn: number, distance: number, final: boolean) => void;
  onStep: (step: 1 | -1) => void;
  onNext: () => void;
}) {
  const dialRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pm = hour >= 12;
  const hand = handSpot(mode, hour, minute, twelve);
  const selected = mode === "minute" ? minute : hour;

  const point = (event: PointerEvent<HTMLDivElement>, final: boolean) => {
    const box = dialRef.current?.getBoundingClientRect();
    if (!box) return;
    const { turn, distance } = pointOnDial(box, event.clientX, event.clientY);
    onPoint(turn, distance, final);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step) {
      event.preventDefault();
      onStep(step);
    } else if (event.key === "Enter" && mode === "hour") {
      event.preventDefault();
      onNext();
    }
  };

  return (
    <div
      ref={dialRef}
      role="slider"
      tabIndex={0}
      aria-label={t(mode === "hour" ? "time.hour" : "time.minute")}
      aria-valuemin={0}
      aria-valuemax={mode === "hour" ? 23 : 59}
      aria-valuenow={selected}
      aria-valuetext={
        mode === "hour" ? String(shownHourOf(hour, twelve)) : pad(minute)
      }
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        point(event, false);
      }}
      onPointerMove={(event) => {
        if (dragging.current) point(event, false);
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return;
        dragging.current = false;
        point(event, true);
      }}
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
        <circle cx={CENTER} cy={CENTER} r={PIN_R} fill="currentColor" />
        <circle cx={hand.x} cy={hand.y} r={HAND_END_R} fill="currentColor" />
      </svg>
      {dialMarks(mode, twelve, pm).map((mark) => {
        const at = spot(mark.index, mark.ring);
        const inner = mark.ring === INNER;
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
              inner ? "text-footnote" : "text-body",
              mark.value === selected
                ? "font-semibold text-paper"
                : inner
                  ? "text-ink-secondary"
                  : "text-ink",
            )}
          >
            {mark.label}
          </span>
        );
      })}
    </div>
  );
}
