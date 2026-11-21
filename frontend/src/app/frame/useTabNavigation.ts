import { useCallback, useEffect, useRef, useState } from "react";
import { ROUTES, type Navigate, type TabId } from "@/ui";
import {
  isAuthPath,
  PROJECT_PATH,
  TAB_BY_PATH,
  tabRootOf,
} from "./frameRoutes";

type Router = {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
};

/** A tab or a sidebar project tapped and on its way (#161). */
export interface PendingTab {
  href: string;
  tab: TabId;
  /** A project page, not one of the four tabs. */
  project: boolean;
  firstVisit: boolean;
}

/**
 * Moving between screens. A tapped tab or project lights up at once and shows its header with a
 * loader or skeleton until its page is there (#161). Tab switches replace the history entry, so
 * Back doesn't walk through every tab visited; Back from a deep link goes to that tab's root
 * instead of out of the app (AP §2.4).
 */
export function useTabNavigation(
  pathname: string,
  router: Router,
  /** Signed in, verified or set up: called as the app is entered from the sign-in screens. */
  onEnterApp: () => void,
) {
  const [pendingTab, setPendingTab] = useState<PendingTab | null>(null);
  const visitedTabs = useRef<Set<TabId>>(new Set());
  const arrivedByDeepLink = useRef(true);
  const previousPath = useRef(pathname);
  const tab: TabId | undefined = TAB_BY_PATH[pathname];

  useEffect(() => {
    if (previousPath.current !== pathname) arrivedByDeepLink.current = false;
    previousPath.current = pathname;
  }, [pathname]);

  // The page has come: the tab counts as opened, and the pending state ends
  useEffect(() => {
    if (tab) visitedTabs.current.add(tab);
    queueMicrotask(() => setPendingTab(null));
  }, [pathname, tab]);

  const navigate = useCallback<Navigate>(
    (href) => {
      const entersApp =
        isAuthPath(pathname) && !isAuthPath(href.split(/[?#]/)[0]!);
      if (entersApp) onEnterApp();
      const to = TAB_BY_PATH[href];
      if (href !== pathname && to)
        setPendingTab({
          href,
          tab: to,
          project: false,
          firstVisit: !visitedTabs.current.has(to),
        });
      else if (href !== pathname && PROJECT_PATH.test(href))
        setPendingTab({
          href,
          tab: "projects",
          project: true,
          firstVisit: false,
        });
      // Tab to tab, into the app, or on from a finished code: Back never returns to Sign in or Verify
      const replaces =
        (href in TAB_BY_PATH && pathname in TAB_BY_PATH) ||
        entersApp ||
        (pathname === ROUTES.verify && href === ROUTES.welcome);
      if (replaces) router.replace(href);
      else router.push(href);
      return true;
    },
    [router, pathname, onEnterApp],
  );

  const back = useCallback(() => {
    if (arrivedByDeepLink.current) router.replace(tabRootOf(pathname));
    else router.back();
  }, [router, pathname]);

  // A tapped tab shows as current at once. A project page has no tab bar or Write a note bar,
  // so a tapped project takes them away at once too, not after its page arrives
  const shownTab = pendingTab
    ? pendingTab.project
      ? undefined
      : pendingTab.tab
    : tab;

  return {
    tab,
    navigate,
    back,
    /** The tapped screen until its page arrives, then null. */
    pendingTab: pendingTab && pendingTab.href !== pathname ? pendingTab : null,
    shownTab,
    /** The sidebar marks the tapped project at once too. */
    shownPath: pendingTab?.href ?? pathname,
  };
}
