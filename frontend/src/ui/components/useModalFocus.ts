import { useEffect, useRef, useState, type RefObject } from "react";

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
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  // An inline onClose changes every render; as an effect dependency it would hand focus back to
  // the opener each time, so Escape (which listens inside the container) never fired
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  // The opener is read while rendering the open: by the time effects run, a field's autoFocus has
  // already taken focus, and handing it back there on close would drop focus on the page (UX-11)
  const [openedFrom, setOpenedFrom] = useState<{
    open: boolean;
    opener: HTMLElement | null;
  }>({ open: false, opener: null });
  if (openedFrom.open !== open)
    setOpenedFrom({
      open,
      opener:
        open &&
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    });
  const opener = openedFrom.opener;

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const firstField = container.querySelector<HTMLElement>(FIELD);
    const target =
      initialFocusRef?.current ?? firstField ?? titleRef.current ?? container;
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

    // On the document: a click on the scrim leaves focus on body, and Esc must still work.
    // Only the top layer answers, so Esc closes one at a time
    const onKeyDown = (event: KeyboardEvent) => {
      const layers = document.querySelectorAll('[aria-modal="true"]');
      if (layers[layers.length - 1] !== container) return;
      if (event.key === "Escape") {
        // A field, picker or popover inside already took this Escape (it calls preventDefault):
        // React's stopPropagation can't stop a listener on the same document node
        if (event.defaultPrevented) return;
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, opener, containerRef, titleRef, initialFocusRef]);
}
