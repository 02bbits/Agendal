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
    for (const href of key.split("|")) {
      if (!href) continue;
      try {
        router.prefetch?.(href);
      } catch {}
    }
  }, [router, key, enabled]);
}
