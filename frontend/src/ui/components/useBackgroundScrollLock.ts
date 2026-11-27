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
 * Whether something between `node` and `root` can still scroll the way `dy` goes (down when
 * positive). A gesture there scrolls it; anywhere else it would run on into the page behind.
 */
function canScrollWithin(node: Element, root: Element, dy: number): boolean {
  for (let el: Element | null = node; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      if (dy === 0) return true;
      if (
        dy < 0
          ? el.scrollTop > 0
          : el.scrollTop + el.clientHeight < el.scrollHeight - 1
      )
        return true;
    }
    if (el === root) break;
  }
  return false;
}

/**
 * While mounted, wheel, touch and scroll keys don't move the page behind `containerRef`: inside
 * it they scroll only what can still scroll that way (so the end of a list, or a part that
 * doesn't scroll, never hands the scroll on to the page). The html/body overflow stays as it is,
 * which keeps the sticky sidebar and headers in place (UX-28).
 */
export function useBackgroundScrollLock(
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const isAllowed = (node: EventTarget | null, dy: number) => {
      if (!(node instanceof Element)) return false;
      const container = containerRef.current;
      // No vertical movement (a sideways wheel) can't run on into the page
      if (container?.contains(node))
        return dy === 0 || canScrollWithin(node, container, dy);
      return node.closest(LAYERS_ABOVE) !== null;
    };

    const onWheel = (e: WheelEvent) => {
      if (!isAllowed(e.target, e.deltaY)) e.preventDefault();
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? touchY;
      const dy = touchY - y;
      touchY = y;
      if (!isAllowed(e.target, dy)) e.preventDefault();
    };
    // Keys keep working anywhere inside (Space types in a field, arrows move the caret)
    const onKeyDown = (e: KeyboardEvent) => {
      const focused = document.activeElement;
      const inside =
        focused instanceof Element &&
        (containerRef.current?.contains(focused) ||
          focused.closest(LAYERS_ABOVE) !== null);
      if (SCROLL_KEYS.includes(e.key) && !inside) e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [containerRef]);
}
