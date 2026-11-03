import { useEffect, useRef, useState } from "react";

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
} {
  const enabled = options?.enabled ?? true;
  const barHeight = options?.barHeight ?? 120;
  const [activeDay, setActiveDay] = useState<string>(initialDay);
  const intersectingRef = useRef<Set<string>>(new Set());

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

  return { activeDay, setActiveDay };
}
