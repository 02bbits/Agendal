import { useEffect, useState } from "react";
import { now } from "../../../lib/clock";

const secondsLeft = (until: number | null | undefined) =>
  until ? Math.max(0, Math.ceil((until - now().getTime()) / 1000)) : 0;

/** Whole seconds until `until` (epoch ms), ticking every second; 0 once it has passed. */
export function useSecondsLeft(until: number | null | undefined): number {
  // Worked out on every render, so the first render with a new `until` already counts down
  // (held in state, it read 0 for one render: Resend enabled, the lockout "ended")
  const [, tick] = useState(0);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      tick((n) => n + 1);
      if (secondsLeft(until) === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return secondsLeft(until);
}
