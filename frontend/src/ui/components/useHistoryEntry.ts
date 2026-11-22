import { useEffect, useId, useRef } from "react";

const MARK = "agendalModal";

interface Entry {
  id: string;
  /** False once the sheet or dialog has closed while its entry was not on top. */
  live: boolean;
  close: () => void | boolean;
}

// One stack for every open sheet and dialog, in the order their history entries were pushed.
// A layer that closes while another layer's entry sits above its own (a picker sheet closing as
// it opens a dialog) can't take its entry off; it stays here as a dead entry and Back skips it.
const stack: Entry[] = [];
let listening = false;

const pushEntry = (id: string) =>
  window.history.pushState({ ...window.history.state, [MARK]: id }, "");

function onPop() {
  const mark = window.history.state?.[MARK];
  const at = stack.findIndex((entry) => entry.id === mark);
  // Every entry above the one we landed on was popped: close the live ones, top first
  const popped = stack.splice(at + 1);
  for (let i = popped.length - 1; i >= 0; i--) {
    const entry = popped[i]!;
    if (!entry.live) continue;
    if (entry.close() === false) {
      // Refused (e.g. to ask "Discard?" first): its entry goes back on
      stack.push(entry);
      pushEntry(entry.id);
      return;
    }
  }
  // Landed on a dead entry: step past it, so one Back or one outside tap closes one layer
  const top = stack[stack.length - 1];
  if (top && !top.live) {
    stack.pop();
    window.history.back();
  }
}

/**
 * Runs `go` once a sheet or dialog that is closing has taken its history entry off (its
 * history.back() fires popstate), or after `waitMs` when its entry was not on top and no popstate
 * comes. Call it right after closing the layer, for a navigation that follows it: a router.push
 * made before that back would be undone by it, leaving the old URL and the new page stuck loading.
 */
export function afterHistoryEntryCloses(go: () => void, waitMs = 250): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", run);
    go();
  };
  window.addEventListener("popstate", run);
  setTimeout(run, waitMs);
}

/**
 * A sheet or dialog takes one history entry while it is open, so Back (the in-app button, the
 * browser's, or the Android gesture) closes it and stays on the screen (AP-4, AP-E9).
 * The entry copies the current state so Next.js still recognises it as its own.
 * `onClose` returning `false` refuses Back (e.g. to ask "Discard?" first): the entry is put back.
 */
export function useHistoryEntry(
  open: boolean,
  onClose: () => void | boolean,
): void {
  const id = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // A cleanup's back waits a tick: React's dev double effect (Strict Mode) runs cleanup and setup
  // straight away, and an immediate back would pop the entry the setup keeps, closing it at once
  const leaving = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(leaving.current);
    if (!listening) {
      window.addEventListener("popstate", onPop);
      listening = true;
    }
    const existing = stack.find((entry) => entry.id === id);
    if (existing) {
      existing.live = true;
    } else {
      stack.push({ id, live: true, close: () => close.current() });
      if (window.history.state?.[MARK] !== id) pushEntry(id);
    }
    return () => {
      const entry = stack.find((e) => e.id === id);
      if (entry) entry.live = false;
      // Closed by ×, Escape or an outside tap: take the entry off if it is still on top,
      // else leave it dead in the stack for Back to skip
      leaving.current = setTimeout(() => {
        const index = stack.findIndex((e) => e.id === id);
        if (index < 0 || stack[index]!.live) return;
        if (window.history.state?.[MARK] === id) {
          stack.splice(index, 1);
          window.history.back();
        }
      });
    };
  }, [open, id]);
}
