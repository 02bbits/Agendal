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
