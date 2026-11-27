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
 * into it from the sign-in screens, and when you sign out. `reason` says why it is up (null: it
 * isn't). It stays until `ready` (the session check has answered, or the screen it was going to
 * is there), at least LOADING_MIN_MS so it never just flashes and at most LOADING_MAX_MS, then
 * fades out and calls `onDone` with the reason that faded. In between, the header, tab bar and
 * sidebar stay, and each tab shows its skeleton the first time it loads.
 */
export function TabLoading({
  reason,
  ready,
  onDone,
  children,
}: {
  reason: string | null;
  ready: boolean;
  onDone?: (faded: string | null) => void;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<"hidden" | "visible" | "hiding">(
    reason !== null ? "visible" : "hidden",
  );
  const [shownFor, setShownFor] = useState(reason);
  if (reason !== shownFor) {
    setShownFor(reason);
    // A new reason, even mid-fade (signed in as the start screen goes): up again. Called off
    // (e.g. sign out held back offline): it fades out at once
    if (reason !== null) setPhase("visible");
    else if (phase === "visible") setPhase("hiding");
  }
  // What was last committed: a timer can fire after the reason or `ready` changed and before
  // the effect that set it clears it, and must not hide the screen for the new reason
  const latest = useRef({ reason, ready });
  useLayoutEffect(() => {
    latest.current = { reason, ready };
  });
  const shownAt = useRef({ reason: null as string | null, at: 0 });

  useEffect(() => {
    if (phase !== "visible") {
      shownAt.current = { reason: null, at: 0 };
      return;
    }
    // Each reason gets its own minimum and maximum
    if (!shownAt.current.at || shownAt.current.reason !== reason)
      shownAt.current = { reason, at: now().getTime() };
    const elapsed = now().getTime() - shownAt.current.at;
    const wait = (ready ? LOADING_MIN_MS : LOADING_MAX_MS) - elapsed;
    const timer = setTimeout(
      () => {
        if (latest.current.reason !== reason || latest.current.ready !== ready)
          return;
        setPhase("hiding");
      },
      Math.max(0, wait),
    );
    return () => clearTimeout(timer);
  }, [phase, ready, reason]);

  useEffect(() => {
    if (phase !== "hiding") return;
    const timer = setTimeout(() => {
      if (latest.current.reason !== reason) return;
      setPhase("hidden");
      // Only the reason that faded ends: one that came after it stays up
      onDone?.(reason);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [phase, reason, onDone]);

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
