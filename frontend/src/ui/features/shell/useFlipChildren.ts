import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Slides the `[data-flip-key]` children of a container to their new place when `layoutKey`
 * changes, and fades in children that just appeared. Uses the Web Animations API, so it never
 * touches inline styles another hook may own.
 */
export function useFlipChildren(
  containerRef: RefObject<HTMLElement | null>,
  layoutKey: string,
) {
  const lastTops = useRef<Map<string, number> | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const base = container.getBoundingClientRect().top;
    const children = [
      ...container.querySelectorAll<HTMLElement>("[data-flip-key]"),
    ];
    const tops = new Map<string, number>();
    for (const el of children) {
      tops.set(el.dataset.flipKey!, el.getBoundingClientRect().top - base);
    }

    const previous = lastTops.current;
    lastTops.current = tops;
    // First render, or no animation support (tests), or the user asked for less motion
    if (
      !previous ||
      typeof children[0]?.animate !== "function" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;

    const easing = "cubic-bezier(.2,.7,.3,1)";
    for (const el of children) {
      const key = el.dataset.flipKey!;
      const was = previous.get(key);
      const now = tops.get(key)!;
      if (was === undefined) {
        el.animate(
          [
            { opacity: 0, transform: "translateY(-4px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 180, easing },
        );
      } else if (was !== now) {
        el.animate(
          [{ transform: `translateY(${was - now}px)` }, { transform: "none" }],
          { duration: 200, easing },
        );
      }
    }
  }, [containerRef, layoutKey]);
}
