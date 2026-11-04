import { useCallback, useEffect, useRef, useState } from "react";

export interface UseActiveDayOptions {
  enabled?: boolean;
  barHeight?: number;
}

/** Scroll-spy over `#day-YYYY-MM-DD` headings below the sticky bar. */
export function useActiveDay(
  initialDay: string,
  days: string[],
  options?: UseActiveDayOptions,
): {
  activeDay: string;
  setActiveDay: (day: string) => void;
  holdActiveDay: (day: string) => void;
} {
  const enabled = options?.enabled ?? true;
  const barHeight = options?.barHeight ?? 120;
  const [activeDay, setActiveDay] = useState<string>(initialDay);
  const intersectingRef = useRef<Set<string>>(new Set());
  const heldRef = useRef<boolean>(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollEndListenerRef = useRef<(() => void) | null>(null);

  const releaseHold = useCallback(() => {
    heldRef.current = false;
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (scrollEndListenerRef.current !== null) {
      window.removeEventListener("scrollend", scrollEndListenerRef.current);
      scrollEndListenerRef.current = null;
    }
  }, []);

  const holdActiveDay = useCallback(
    (day: string) => {
      setActiveDay(day);
      heldRef.current = true;

      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
      if (scrollEndListenerRef.current !== null) {
        window.removeEventListener("scrollend", scrollEndListenerRef.current);
      }

      const onScrollEnd = () => {
        releaseHold();
      };
      scrollEndListenerRef.current = onScrollEnd;
      window.addEventListener("scrollend", onScrollEnd, { once: true });

      holdTimerRef.current = setTimeout(() => {
        releaseHold();
      }, 900);
    },
    [releaseHold],
  );

  useEffect(() => {
    return () => {
      releaseHold();
    };
  }, [releaseHold]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const onScroll = () => {
      if (heldRef.current) return;
      const scrollHeight = document.documentElement?.scrollHeight ?? 0;
      if (
        days.length > 0 &&
        window.innerHeight + window.scrollY >= scrollHeight - 2
      ) {
        const lastDay = days[days.length - 1];
        if (lastDay) {
          setActiveDay(lastDay);
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [days, enabled]);

  useEffect(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const intersecting = intersectingRef.current;
    const rootMargin = `-${barHeight}px 0px -70% 0px`;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target?.id;
          if (!id) continue;
          if (entry.isIntersecting) {
            intersecting.add(id);
          } else {
            intersecting.delete(id);
          }
        }

        if (heldRef.current) return;

        // Active day = the top-most heading inside that band.
        // If none intersects, keep the last one.
        let topDay: string | null = null;
        for (const day of days) {
          if (intersecting.has("day-" + day)) {
            topDay = day;
            break;
          }
        }

        if (topDay) {
          setActiveDay(topDay);
        }
      },
      { rootMargin },
    );

    for (const day of days) {
      const el = document.getElementById("day-" + day);
      if (el) {
        observer.observe(el);
      }
    }

    return () => {
      observer.disconnect();
      intersecting.clear();
    };
  }, [days, enabled, barHeight]);

  return { activeDay, setActiveDay, holdActiveDay };
}
