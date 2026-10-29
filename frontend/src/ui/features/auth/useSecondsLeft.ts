import { useEffect, useState } from "react";
import { now } from "../../../lib/clock";

const secondsLeft = (until: number | null | undefined) =>
  until ? Math.max(0, Math.ceil((until - now().getTime()) / 1000)) : 0;

/** Whole seconds until `until` (epoch ms), ticking every second; 0 once it has passed. */
export function useSecondsLeft(until: number | null | undefined): number {
  const [left, setLeft] = useState(secondsLeft(until));
  useEffect(() => {
    const tick = () => {
      const remaining = secondsLeft(until);
      setLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [until]);
  return left;
}
