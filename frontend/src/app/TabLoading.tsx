"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { now } from "@/lib/clock";
import { LoadingScreen, ScreenHeader, type Navigate } from "@/ui";

/** Shortest time the start screen stays up, so it never just flashes. */
export const LOADING_MIN_MS = 400;
/** Longest: offline or slow, the app comes up anyway and the tab's skeleton carries on. */
export const LOADING_MAX_MS = 3000;
const FADE_MS = 150;

/** Why the full-screen loading screen is up. */
export type Splash =
  /** The app opening on one of its screens. */
  | "start"
  /** Signed in, verified or set up: going from the sign-in screens into the app. */
  | "enter"
  /** Signing out, or the session ended: going back to Sign in. */
  | "leave";

/**
 * The full-screen loading screen (#161), as Instagram does: when the app starts, when you go
 * into it from the sign-in screens, and when you sign out. It stays until `ready` (the session
 * check has answered, or the screen it was going to is there), at least LOADING_MIN_MS so it
 * never just flashes and at most LOADING_MAX_MS, then fades out and calls `onDone`. In between,
 * the header, tab bar and sidebar stay, and each tab shows its skeleton the first time it loads.
 */
export function TabLoading({
  show,
  ready,
  onDone,
  children,
}: {
  show: boolean;
  ready: boolean;
  onDone?: () => void;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<"hidden" | "visible" | "hiding">(
    show ? "visible" : "hidden",
  );
  const [shown, setShown] = useState(show);
  if (show !== shown) {
    setShown(show);
    // Called off (e.g. sign out held back offline): it fades out at once
    if (show) setPhase("visible");
    else if (phase === "visible") setPhase("hiding");
  }
  // Something new to wait for while it fades (signed in as the start screen goes): it comes back,
  // or the fade's end would call onDone and drop the screen going into the app
  const [wasReady, setWasReady] = useState(ready);
  if (ready !== wasReady) {
    setWasReady(ready);
    if (show && !ready && phase === "hiding") setPhase("visible");
  }
  const shownAt = useRef(0);
  // `ready` as last committed: a minimum-time timer can fire after it turned false and before
  // the effect below clears that timer
  const readyNow = useRef(ready);
  useLayoutEffect(() => {
    readyNow.current = ready;
  });

  useEffect(() => {
    if (phase !== "visible") {
      shownAt.current = 0;
      return;
    }
    if (!shownAt.current) shownAt.current = now().getTime();
    const elapsed = now().getTime() - shownAt.current;
    const wait = (ready ? LOADING_MIN_MS : LOADING_MAX_MS) - elapsed;
    const timer = setTimeout(
      () => {
        // Set for the minimum, but there is something to wait for now: the maximum's timer follows
        if (ready && !readyNow.current) return;
        setPhase("hiding");
      },
      Math.max(0, wait),
    );
    return () => clearTimeout(timer);
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== "hiding") return;
    const timer = setTimeout(() => {
      setPhase("hidden");
      onDone?.();
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [phase, onDone]);

  return (
    <>
      {children}
      {phase !== "hidden" && <LoadingScreen visible={phase === "visible"} />}
    </>
  );
}

/**
 * The content area of a tab or project tapped and on its way (#161): the header the screen will
 * show, then `body` (that screen's own skeleton, or the loading screen on a phone's first visit
 * to a tab), so one skeleton runs from the tap to the data. A project brings its own header in
 * its skeleton, so it passes no `title`.
 */
export function TabPending({
  title,
  overline,
  accountInitial,
  navigate,
  body,
}: {
  title?: string;
  overline?: string;
  accountInitial: string;
  navigate: Navigate;
  body: ReactNode;
}) {
  return (
    <div data-testid="tab-pending" aria-busy="true">
      {title && (
        <ScreenHeader
          overline={overline}
          title={title}
          accountInitial={accountInitial}
          navigate={navigate}
        />
      )}
      {body}
    </div>
  );
}
