import { useEffect, type RefObject } from "react";

const SCROLL_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
];

// A modal or a popover drawn over the locked layer keeps its own scrolling and keys
const LAYERS_ABOVE = '[aria-modal="true"], [role="presentation"]';

/**
 * While mounted, wheel, touch and scroll keys outside `containerRef` don't move
 * the page. The html/body overflow stays as it is, which keeps the sticky
 * sidebar and headers in place (UX-28).
 */
export function useBackgroundScrollLock(
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const isAllowed = (node: EventTarget | null) =>
      node instanceof Element &&
      (Boolean(containerRef.current?.contains(node)) ||
        node.closest(LAYERS_ABOVE) !== null);

    const onScrollGesture = (e: Event) => {
      if (!isAllowed(e.target)) e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.includes(e.key) && !isAllowed(document.activeElement)) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", onScrollGesture, { passive: false });
    window.addEventListener("touchmove", onScrollGesture, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onScrollGesture);
      window.removeEventListener("touchmove", onScrollGesture);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [containerRef]);
}
