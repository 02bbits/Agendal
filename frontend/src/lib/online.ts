import { useSyncExternalStore } from "react";

// `navigator.onLine` can claim a connection that isn't there (captive portal, AP-E4), so a fetch
// that fails counts as offline too, until the next answer or `online` event (AP §2.2)
let fetchFailed = false;
const listeners = new Set<() => void>();

export function reportFetch(ok: boolean) {
  if (fetchFailed === !ok) return;
  fetchFailed = !ok;
  if (fetchFailed)
    window.addEventListener("online", () => reportFetch(true), { once: true });
  listeners.forEach((listener) => listener());
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/** True while the browser reports no connection or the last call failed. Prerendered pages assume online. */
export const useOffline = () =>
  useSyncExternalStore(
    subscribe,
    () => !navigator.onLine || fetchFailed,
    () => false,
  );
