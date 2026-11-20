/** The dial's drawing size; it scales to fit the sheet. */
export const SIZE = 256;
export const CENTER = SIZE / 2;
/** The outer ring of marks (0–11, or 1–12, and the minutes). */
export const OUTER = 104;
/** The inner ring of a 24-hour clock (12–23). */
export const INNER = 68;
const MARKS = 12;
const MINUTES_PER_MARK = 5;

export const pad = (n: number) => String(n).padStart(2, "0");

export type DialMode = "hour" | "minute";

/** Where the i-th of 12 marks sits on a ring, 0 at the top, clockwise. */
export function spot(i: number, radius: number) {
  const angle = (i / MARKS) * 2 * Math.PI;
  return {
    x: CENTER + radius * Math.sin(angle),
    y: CENTER - radius * Math.cos(angle),
  };
}

/** The hour as the clock face shows it: 12-hour clocks show 12 for noon and midnight. */
export const shownHourOf = (hour: number, twelve: boolean) =>
  twelve ? hour % 12 || 12 : hour;

export interface DialMark {
  label: string;
  value: number;
  ring: number;
  index: number;
}

/** The numbers round the dial: minutes in fives, or the hours on one ring (12h) or two (24h). */
export function dialMarks(
  mode: DialMode,
  twelve: boolean,
  pm: boolean,
): DialMark[] {
  const ring = (
    radius: number,
    mark: (i: number) => Omit<DialMark, "ring" | "index">,
  ) =>
    Array.from({ length: MARKS }, (_, i) => ({
      ...mark(i),
      ring: radius,
      index: i,
    }));
  if (mode === "minute")
    return ring(OUTER, (i) => ({
      label: pad(i * MINUTES_PER_MARK),
      value: i * MINUTES_PER_MARK,
    }));
  const outer = ring(OUTER, (i) => ({
    label: String(twelve ? i || 12 : i),
    value: twelve ? (pm ? 12 : 0) + i : i,
  }));
  if (twelve) return outer;
  return [
    ...outer,
    ...ring(INNER, (i) => ({ label: String(i + 12), value: i + 12 })),
  ];
}

/** Where the hand points: the minute on the outer ring, or the hour on its ring. */
export function handSpot(
  mode: DialMode,
  hour: number,
  minute: number,
  twelve: boolean,
) {
  if (mode === "minute") return spot(minute / MINUTES_PER_MARK, OUTER);
  return spot(hour % 12, !twelve && hour >= 12 ? INNER : OUTER);
}

/**
 * A point on the dial as a turn (0 at the top, clockwise, 0–1) and its distance from the centre
 * in drawing units, whatever size the dial is shown at.
 */
export function pointOnDial(box: DOMRect, clientX: number, clientY: number) {
  const scale = box.width / SIZE;
  const x = clientX - box.left - scale * CENTER;
  const y = clientY - box.top - (box.height / SIZE) * CENTER;
  return {
    turn: (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1,
    distance: Math.hypot(x, y) / scale,
  };
}

/** The hour a point picks: on a 24-hour clock the inner ring is 12–23. */
export function hourAt(
  turn: number,
  distance: number,
  twelve: boolean,
  pm: boolean,
): number {
  const index = Math.round(turn * MARKS) % MARKS;
  if (twelve) return (pm ? 12 : 0) + index;
  return distance < (OUTER + INNER) / 2 ? index + 12 : index;
}

export const minuteAt = (turn: number) => Math.round(turn * 60) % 60;
