import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD =
  "input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

/**
 * Focus rules shared by sheets and dialogs (UX-10, UX-11):
 * focus the first field (or the title), trap Tab inside, Escape closes,
 * and focus returns to the opener on close.
 */
export function useModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  titleRef: RefObject<HTMLElement | null>,
  open: boolean,
  onEscape: () => void,
): void {
  // An inline onClose changes every render; as an effect dependency it would hand focus back to
  // the opener each time, so Escape (which listens inside the container) never fired
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const firstField = container.querySelector<HTMLElement>(FIELD);
    const target = firstField ?? titleRef.current ?? container;
    // The modal fades in from visibility: hidden, which refuses focus, so try again on the next
    // frames until it lands (at most half a second)
    let frame = 0;
    let tries = 30;
    const focusTarget = () => {
      target.focus();
      if (!container.contains(document.activeElement) && tries-- > 0)
        frame = requestAnimationFrame(focusTarget);
    };
    focusTarget();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        escape.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !container.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("keydown", onKeyDown);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, containerRef, titleRef]);
}
