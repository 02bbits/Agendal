import { useEffect, useRef, useState, type RefObject } from "react";
import {
  animate,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { clamp01 } from "./slots";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const WASH_IN = 0.3;
const WASH_OUT = 0.2;
const WASH_OUT_DELAY = 0.06;
const SINK_DELAY = 0.06;
const SINK_STEP = 0.03;
const SINK_DURATION = 0.3;
const UNSINK_DELAY = 0.1;
const CHECK_DELAY = 0.28;
const CHECK_DURATION = 0.35;
const CHECK_OUT = 0.15;
const CHECK_RISE = 8;

export type CodeSlotsStatus = "idle" | "error" | "success";

/**
 * The accepted code: a wash opens from the middle over the slots, the digits sink one after
 * another and a tick rises in. It closes again if the code is undone. With reduced motion it
 * just shows or hides.
 */
export function useSuccessWash({
  status,
  drops,
  washRadius,
  live,
}: {
  status: CodeSlotsStatus;
  drops: MotionValue<number>[];
  washRadius: number;
  live: RefObject<{ reduce: boolean | null; bounce: number }>;
}) {
  const success = status === "success";
  const statusRef = useRef<CodeSlotsStatus>(status);
  const open = useMotionValue<number>(success ? 1 : 0);
  const check = useMotionValue<number>(success ? 1 : 0);
  // Veiled: the caret hides from the start of success until the wash has closed again.
  // Covered: the slots are hidden once the wash covers them all
  const [prevStatus, setPrevStatus] = useState(status);
  const [veiled, setVeiled] = useState(success);
  const [covered, setCovered] = useState(success);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (success) setVeiled(true);
    // Undone: the slots show again at once, under the closing wash
    else if (prevStatus === "success") setCovered(false);
  }

  useEffect(() => {
    const was = statusRef.current;
    statusRef.current = status;
    const { reduce, bounce } = live.current;
    if (status === "success") {
      if (reduce) {
        open.jump(1);
        drops.forEach((d) => d.jump(1));
        check.jump(1);
        queueMicrotask(() => setCovered(true));
        return;
      }
      // Hide the slots only once the wash covers them all, and not if the code was undone meanwhile
      animate(open, 1, { duration: WASH_IN, ease: EASE_OUT }).then(() => {
        if (statusRef.current === "success") setCovered(true);
      });
      drops.forEach((d, k) =>
        animate(d, 1, {
          type: "spring",
          duration: SINK_DURATION,
          bounce: 0,
          delay: SINK_DELAY + k * SINK_STEP,
        }),
      );
      animate(check, 1, {
        type: "spring",
        duration: CHECK_DURATION,
        bounce,
        delay: CHECK_DELAY,
      });
      return;
    }
    if (was !== "success") return;
    if (reduce) {
      open.jump(0);
      check.jump(0);
      drops.forEach((d) => d.jump(0));
      queueMicrotask(() => setVeiled(false));
      return;
    }
    animate(check, 0, { duration: CHECK_OUT, ease: EASE_OUT });
    animate(open, 0, {
      duration: WASH_OUT,
      ease: EASE_OUT,
      delay: WASH_OUT_DELAY,
    }).then(() => {
      if (open.get() === 0) setVeiled(false);
    });
    drops.forEach((d) =>
      animate(d, 0, {
        type: "spring",
        duration: SINK_DURATION,
        bounce: 0,
        delay: UNSINK_DELAY,
      }),
    );
  }, [status, check, drops, open, live]);

  const washClip = useTransform(
    open,
    (o) => `inset(0 ${(1 - clamp01(o)) * 50}% round ${washRadius + 1}px)`,
  );
  const checkTransform = useTransform(
    check,
    (c) =>
      `translateY(${(1 - c) * CHECK_RISE}px) scale(${0.85 + 0.15 * Math.max(c, 0)})`,
  );
  const checkOpacity = useTransform(check, clamp01);

  return { statusRef, veiled, covered, washClip, checkTransform, checkOpacity };
}
