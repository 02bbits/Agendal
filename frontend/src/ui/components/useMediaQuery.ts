import { useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook based on matchMedia and useSyncExternalStore.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const media = window.matchMedia(query);
      if (media.addEventListener) {
        media.addEventListener("change", callback);
        return () => media.removeEventListener("change", callback);
      }
      media.addListener(callback);
      return () => media.removeListener(callback);
    },
    () => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia(query).matches;
    },
    () => false,
  );
}

/** From here the app has a sidebar instead of the tab bar, and popups instead of sheets (UX-27). */
export const WIDE_SCREEN = "(min-width: 768px)";
/** From here a task opens in a panel beside its list instead of on its own page. */
export const PANEL_SCREEN = "(min-width: 1280px)";

export const useWideScreen = () => useMediaQuery(WIDE_SCREEN);
export const usePanelScreen = () => useMediaQuery(PANEL_SCREEN);
