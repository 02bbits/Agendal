// IM-50: registers /sw.js and reports a new version waiting to take over (UX-42).
// The build id in the URL makes every deploy a new worker script.

/** Calls `onWaiting` when a new version is installed and an older one is in control. */
export function registerServiceWorker(
  onWaiting: (worker: ServiceWorker) => void,
) {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator))
    return;
  const { serviceWorker } = navigator;
  const report = (worker: ServiceWorker | null) => {
    // Without a controller this is the first install: nothing is being replaced
    if (worker && serviceWorker.controller) onWaiting(worker);
  };
  if (!serviceWorker.controller)
    // First visit: this page's files loaded before any worker, so hand them over to cache (AP §2.2)
    void serviceWorker.ready.then((registration) =>
      registration.active?.postMessage({
        precache: [
          window.location.pathname,
          ...performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => new URL(name).pathname.startsWith("/_next/")),
        ],
      }),
    );
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
    // AP-E11: the app works online without it. The "offline isn't available" notice is IM-51.
    .catch(() => {});
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
