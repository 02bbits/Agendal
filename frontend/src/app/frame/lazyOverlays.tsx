"use client";
import { lazy, Suspense, type ComponentType } from "react";
import { cacheLoadedAssets } from "@/lib/serviceWorker";

// NF-4: overlays opened only on demand, reached from nowhere else in the frame, load in their
// own chunk. ProjectSheet and NewTaskSheet stay static: TaskPanel already pulls them in.
// React.lazy, not next/dynamic: next/dynamic still put these chunks in the page's first load.
const loaders = {
  noteEditor: () =>
    import("@/ui/features/notes/NoteEditor").then((m) => m.NoteEditor),
  searchPopup: () =>
    import("@/ui/features/lists/SearchPopup").then((m) => m.SearchPopup),
  settings: () =>
    import("./AppSettingsScreen").then((m) => m.AppSettingsScreen),
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

export const NoteEditor = onDemand(loaders.noteEditor);
export const SearchPopup = onDemand(loaders.searchPopup);
export const AppSettingsScreen = onDemand(loaders.settings);

/**
 * Fetches the overlay chunks once the page is idle, then has the service worker cache them,
 * so they still open offline (note editor, search and Settings all work offline).
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
