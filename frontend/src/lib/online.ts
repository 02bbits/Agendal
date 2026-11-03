import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/** True while the browser reports no connection. Prerendered pages assume online. */
export const useOffline = () =>
  useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
