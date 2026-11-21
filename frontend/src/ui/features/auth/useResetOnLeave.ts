import { useEffect, useRef } from "react";

/**
 * Runs `reset` when the screen is left. Next keeps a left page alive with its state
 * (cacheComponents), so without it a finished step (a code with its tick, the 2FA step) would
 * still be there the next time the screen shows, e.g. after Sign out.
 */
export function useResetOnLeave(reset: () => void) {
  const latest = useRef(reset);
  useEffect(() => {
    latest.current = reset;
  });
  useEffect(() => () => latest.current(), []);
}
