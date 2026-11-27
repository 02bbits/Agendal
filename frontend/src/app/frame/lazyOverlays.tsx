"use client";
import { lazy, Suspense, type ComponentType } from "react";
import { cacheLoadedAssets } from "@/lib/serviceWorker";

// NF-4: overlays opened only on demand, reached from nowhere else in the frame, load in their
// own chunk. ProjectSheet and NewTaskSheet stay static: TaskPanel already pulls them in.
// NoteEditor stays static too: it focuses in the opener's tap so iOS opens the keyboard, and
// a lazy component always mounts a tick later on its first render, even once loaded (NC §2.1).
// React.lazy, not next/dynamic: next/dynamic still put these chunks in the page's first load.
const loaders = {
  searchPopup: () =>
    import("@/ui/features/lists/SearchPopup").then((m) => m.SearchPopup),
  settings: () =>
    import("./AppSettingsScreen").then((m) => m.AppSettingsScreen),
  // A note's result over the screen it was written on (wide, after Make tasks)
  noteResult: () =>
    import("./NoteResultOverlay").then((m) => m.NoteResultOverlay),
};

/** A component that loads on its first render and shows nothing while it loads. */
function onDemand<P extends object>(load: () => Promise<ComponentType<P>>) {
  const Lazy = lazy(() => load().then((component) => ({ default: component })));
  return function OnDemand(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}

export const SearchPopup = onDemand(loaders.searchPopup);
export const AppSettingsScreen = onDemand(loaders.settings);
export const NoteResultOverlay = onDemand(loaders.noteResult);

/**
 * Fetches the overlay chunks once the page is idle, then has the service worker cache them,
 * so they still open offline (search and Settings both work offline).
 */
export function warmOverlays(): () => void {
  const idle =
    window.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 1));
  const cancelIdle = window.cancelIdleCallback ?? clearTimeout;
  const id = idle(() => {
    void Promise.all(Object.values(loaders).map((load) => load()))
      .then(() => cacheLoadedAssets())
      .catch(() => {});
  });
  return () => cancelIdle(id as number);
}
