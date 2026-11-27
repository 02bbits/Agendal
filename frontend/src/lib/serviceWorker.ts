// IM-50: registers /sw.js and reports a new version waiting to take over (UX-42).
// The build id in the URL makes every deploy a new worker script.

let unavailable = false;
/** AP-E11: no service worker (private mode, storage blocked), so the app can't open offline. */
export const offlineUnavailable = () => unavailable;

/** Calls `onWaiting` when a new version is installed and an older one is in control. */
export function registerServiceWorker(
  onWaiting: (worker: ServiceWorker) => void,
) {
  if (process.env.NODE_ENV !== "production") {
    // Switching from local production (`next start`) back to `next dev` leaves the production SW
    // controlling localhost; unregister it and drop its shell caches so Ctrl+R never serves stale dev chunks.
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      void navigator.serviceWorker
        .getRegistrations()
        .then(async (regs) => {
          if (regs.length === 0) return;
          await Promise.all(regs.map((r) => r.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(
              keys
                .filter((k) => k.startsWith("agendal-shell-"))
                .map((k) => caches.delete(k)),
            );
          }
          if (hadController) window.location.reload();
        })
        .catch(() => {});
    }
    return;
  }
  if (!("serviceWorker" in navigator)) {
    unavailable = true;
    return;
  }
  const { serviceWorker } = navigator;
  const report = (worker: ServiceWorker | null) => {
    // Without a controller this is the first install: nothing is being replaced
    if (worker && serviceWorker.controller) onWaiting(worker);
  };
  // First visit: this page's files loaded before any worker, so hand them over to cache (AP §2.2)
  if (!serviceWorker.controller) cacheLoadedAssets([window.location.pathname]);
  serviceWorker
    .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`)
    .then((registration) => {
      report(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const next = registration.installing;
        next?.addEventListener("statechange", () => {
          if (next.state === "installed") report(next);
        });
      });
    })
    // AP-E11: the app works online without it; the offline banner says offline isn't available
    .catch(() => {
      unavailable = true;
    });
}

/**
 * Asks the worker to cache every /_next/ file this page has loaded so far, plus `extra`.
 * It skips what it already has, so calling it again after a lazy chunk loads is cheap.
 */
export function cacheLoadedAssets(extra: string[] = []) {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator))
    return;
  void navigator.serviceWorker.ready.then((registration) =>
    registration.active?.postMessage({
      precache: [
        ...extra,
        ...performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => new URL(name).pathname.startsWith("/_next/")),
      ],
    }),
  );
}

/** Lets the waiting version take over, then reloads onto it. */
export function activateUpdate(worker: ServiceWorker) {
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => window.location.reload(),
    { once: true },
  );
  worker.postMessage("skipWaiting");
}
