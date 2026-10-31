import { useEffect, useState } from "react";
import { localTime, today } from "../../../lib/clock";
import type { Clock } from "./types";

function msUntilNextMidnight(clock: Clock): number {
  const at = clock.now();
  const [hStr, mStr] = localTime(clock.timeZone, at).split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);
  const seconds = at.getUTCSeconds();
  const ms = at.getUTCMilliseconds();
  const elapsedMs = ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms;
  const msInDay = 24 * 60 * 60 * 1000;
  const remaining = msInDay - elapsedMs;
  return remaining > 0 ? remaining : msInDay;
}

export function createZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Keeps track of today's date in the clock's time zone.
 * Recomputes at local midnight, re-arms on visibilitychange, and clears on unmount.
 */
export function useToday(clock: Clock): string {
  const [currentDate, setCurrentDate] = useState(() =>
    today(clock.timeZone, clock.now()),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const armTimer = () => {
      if (timer) clearTimeout(timer);
      const delay = msUntilNextMidnight(clock);
      timer = setTimeout(() => {
        setCurrentDate(today(clock.timeZone, clock.now()));
        armTimer();
      }, delay);
    };

    const handleVisibility = () => {
      setCurrentDate(today(clock.timeZone, clock.now()));
      armTimer();
    };

    armTimer();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [clock]);

  return currentDate;
}
