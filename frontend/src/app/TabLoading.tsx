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
 * The content area of a tab tapped for the first time, while its page is on its way (#161): the
 * header as the tab will show it, then on a phone the loading screen and from 768px a skeleton
 * of the list. The tab bar and sidebar stay around it.
 */
export function TabPending({
  title,
  overline,
  accountInitial,
  navigate,
  wide,
}: {
  title: string;
  overline?: string;
  accountInitial: string;
  navigate: Navigate;
  wide: boolean;
}) {
  return (
    <div data-testid="tab-pending" aria-busy="true">
      <ScreenHeader
        overline={overline}
        title={title}
        accountInitial={accountInitial}
        navigate={navigate}
      />
      {wide ? (
        <div
          data-testid="tab-skeleton"
          className="flex flex-col gap-6 animate-pulse motion-reduce:animate-none"
        >
          {[3, 2].map((rows, group) => (
            <div key={group}>
              <div className="mb-2.5 mt-2 h-5 w-28 rounded-lg bg-fill/70" />
              <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
                {Array.from({ length: rows }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
                  >
                    <div className="size-5 shrink-0 rounded-full bg-fill/80" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="h-4 w-1/2 rounded-xl bg-fill/80" />
                      <div className="h-3 w-1/4 rounded-lg bg-fill/60" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <LoadingScreen inline />
      )}
    </div>
  );
}
