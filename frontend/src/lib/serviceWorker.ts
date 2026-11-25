// IM-50: registers /sw.js and reports a new version waiting to take over (UX-42).
// The build id in the URL makes every deploy a new worker script.

let unavailable = false;
/** AP-E11: no service worker (private mode, storage blocked), so the app can't open offline. */
export const offlineUnavailable = () => unavailable;

const UPDATE_CHECK_INTERVAL_MS = 60_000;

/** Calls `onWaiting` when a new version is installed and an older one is in control. */
export function registerServiceWorker(
  onWaiting: (worker: ServiceWorker) => void,
): () => void {
  if (process.env.NODE_ENV !== "production") return () => {};
  if (!("serviceWorker" in navigator)) {
    unavailable = true;
    return () => {};
  }
  const { serviceWorker } = navigator;
  let lastNotified: ServiceWorker | null = null;
  const report = (worker: ServiceWorker | null) => {
    // Without a controller this is the first install: nothing is being replaced
    if (worker && serviceWorker.controller && worker !== lastNotified) {
      lastNotified = worker;
      onWaiting(worker);
    }
  };
  const watchRegistration = (registration: ServiceWorkerRegistration) => {
    report(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const next = registration.installing;
      next?.addEventListener("statechange", () => {
        if (next.state === "installed") report(next);
      });
    });
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

  let registeredBuildId = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
  const registerBuild = (buildId: string) =>
    serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(buildId)}`)
      .then(watchRegistration);

  registerBuild(registeredBuildId)
    // AP-E11: the app works online without it; the offline banner says offline isn't available
    .catch(() => {
      unavailable = true;
    });

  let checking = false;
  const checkForUpdate = async () => {
    if (checking || unavailable || typeof fetch !== "function") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    checking = true;
    try {
      const res = await fetch("/app-version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: unknown };
      if (
        typeof data.buildId === "string" &&
        data.buildId &&
        data.buildId !== registeredBuildId
      ) {
        registeredBuildId = data.buildId;
        await registerBuild(data.buildId);
      }
    } catch {
      // Offline or transient network error; retry on next check
    } finally {
      checking = false;
    }
  };

  const onVisibleOrFocus = () => {
    if (
      typeof document === "undefined" ||
      document.visibilityState === "visible"
    ) {
      void checkForUpdate();
    }
  };
  document.addEventListener("visibilitychange", onVisibleOrFocus);
  window.addEventListener("focus", onVisibleOrFocus);
  const intervalId = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void checkForUpdate();
    }
  }, UPDATE_CHECK_INTERVAL_MS);

  return () => {
    document.removeEventListener("visibilitychange", onVisibleOrFocus);
    window.removeEventListener("focus", onVisibleOrFocus);
    window.clearInterval(intervalId);
  };
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
