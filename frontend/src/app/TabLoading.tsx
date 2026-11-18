"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { now } from "@/lib/clock";
import { LoadingScreen, ScreenHeader, type Navigate } from "@/ui";

/** Shortest time the start screen stays up, so it never just flashes. */
export const LOADING_MIN_MS = 400;
/** Longest: offline or slow, the app comes up anyway and the tab's skeleton carries on. */
export const LOADING_MAX_MS = 3000;
const FADE_MS = 150;

/**
 * The full-screen loading screen when the app starts on a tab (#161), as Instagram does: it waits
 * only for the app to start (`ready`: the first session check has answered), at least
 * LOADING_MIN_MS and at most LOADING_MAX_MS, then fades out and never comes back. From then on
 * the header, tab bar and sidebar stay, and each tab shows its skeleton the first time it loads.
 */
export function TabLoading({
  tab,
  ready,
  children,
}: {
  tab: string | null;
  ready: boolean;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<"hidden" | "visible" | "hiding">(
    tab ? "visible" : "hidden",
  );
  const shownAt = useRef(0);

  useEffect(() => {
    if (phase !== "visible") return;
    if (!shownAt.current) shownAt.current = now().getTime();
    const elapsed = now().getTime() - shownAt.current;
    const wait = (ready ? LOADING_MIN_MS : LOADING_MAX_MS) - elapsed;
    const timer = setTimeout(() => setPhase("hiding"), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== "hiding") return;
    const timer = setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

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
