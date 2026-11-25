import { useEffect } from "react";

type Router = { prefetch?: (href: string) => void };

const PREFETCH_DELAY_MS = 4500;

/**
 * Fetches screens ahead so a first tap doesn't wait for them. Only a speed-up: a router without
 * it (tests) or a failed fetch changes nothing.
 */
export function usePrefetch(
  router: Router,
  hrefs: readonly string[],
  enabled: boolean,
) {
  const key = hrefs.join("|");
  useEffect(() => {
    if (!enabled) return;
    let idleId: number | undefined;
    const run = () => {
      for (const href of key.split("|")) {
        if (!href) continue;
        try {
          router.prefetch?.(href);
        } catch {}
      }
    };
    // Wait until after the initial page load and TTI window settle before prefetching other routes
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(run, { timeout: 2000 });
      } else {
        run();
      }
    }, PREFETCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      if (
        idleId !== undefined &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [router, key, enabled]);
}
