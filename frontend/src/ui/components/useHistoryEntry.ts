import { useEffect, useId, useRef } from "react";

const MARK = "agendalModal";

/**
 * A sheet or dialog takes one history entry while it is open, so Back (the in-app button, the
 * browser's, or the Android gesture) closes it and stays on the screen (AP-4, AP-E9).
 * The entry copies the current state so Next.js still recognises it as its own.
 */
export function useHistoryEntry(open: boolean, onClose: () => void): void {
  const id = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ ...window.history.state, [MARK]: id }, "");
    // Stacked sheets and dialogs share the event: only those whose entry is gone close
    const onPop = () => {
      if (window.history.state?.[MARK] !== id) close.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed by × or Escape: the entry is still on top, so take it off
      if (window.history.state?.[MARK] === id) window.history.back();
    };
  }, [open, id]);
}
