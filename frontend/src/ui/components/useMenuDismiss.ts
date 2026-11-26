import { useEffect, type RefObject } from "react";

/**
 * Closes an open menu on a press outside it, or on Escape, which gives focus back to its
 * trigger (UX-11).
 */
export function useMenuDismiss(
  open: boolean,
  close: () => void,
  menu: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, menu, trigger]);
}
