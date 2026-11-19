import { useState } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { clamp01 } from "./slots";

/** How far into the sink a digit is gone completely. */
export const SINK_FADE = 0.6;

/**
 * One slot: its fill grows as a digit lands, the digit rises into place, and on success it sinks
 * and fades under the wash. A cleared digit stays drawn while its spring runs out.
 */
export function Slot({
  mv,
  drop,
  char,
  active,
  rise,
  sink,
}: {
  /** 0 empty to 1 filled. */
  mv: MotionValue<number>;
  /** 0 in place to 1 sunk under the success wash. */
  drop: MotionValue<number>;
  char: string;
  active: boolean;
  rise: number;
  sink: number;
}) {
  const [prevChar, setPrevChar] = useState(char);
  const [shown, setShown] = useState(char);
  if (char !== prevChar) {
    setPrevChar(char);
    if (char) setShown(char);
  }

  const fill = useTransform(mv, (t) => `scale(${Math.max(t, 0)})`);
  const lift = useTransform(
    [mv, drop],
    ([t, d]) =>
      `translateY(${(1 - (t as number)) * rise + Math.max(d as number, 0) * sink}px)`,
  );
  const ink = useTransform(
    [mv, drop],
    ([t, d]) => clamp01(t as number) * (1 - clamp01((d as number) / SINK_FADE)),
  );

  return (
    <span
      className="code-slots__slot"
      data-active={active ? "" : undefined}
      data-filled={char ? "" : undefined}
      aria-hidden="true"
    >
      <motion.span className="code-slots__fill" style={{ transform: fill }} />
      {shown ? (
        <motion.span
          className="code-slots__digit"
          style={{ transform: lift, opacity: ink }}
        >
          {shown}
        </motion.span>
      ) : null}
    </span>
  );
}
