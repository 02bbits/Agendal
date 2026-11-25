import { useEffect } from "react";

type Router = { prefetch?: (href: string) => void };

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
    const run = () => {
      for (const href of key.split("|")) {
        if (!href) continue;
        try {
          router.prefetch?.(href);
        } catch {}
      }
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(run, 1000);
    return () => clearTimeout(timer);
  }, [router, key, enabled]);
}
