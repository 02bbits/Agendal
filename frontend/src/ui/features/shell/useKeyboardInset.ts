import { useEffect } from "react";

const FIELD = "input, textarea, select, [contenteditable='true']";

/**
 * Tracks the on-screen keyboard with `visualViewport` (UX-20): sets
 * `--keyboard-inset` on <html> to the height the keyboard covers, so fixed
 * bottom bars and sheets can sit above it. While the keyboard is open, the
 * focused field is scrolled into view (UX-21).
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;

    const update = () => {
      const inset = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
      );
      root.style.setProperty("--keyboard-inset", `${inset}px`);
      const focused = document.activeElement;
      if (
        inset > 0 &&
        focused instanceof HTMLElement &&
        focused.matches(FIELD)
      ) {
        focused.scrollIntoView?.({ block: "nearest" });
      }
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
