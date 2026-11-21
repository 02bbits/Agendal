import { useMemo, useSyncExternalStore } from "react";
import {
  parseSidebarTabs,
  parseSidebarTabsOrder,
  readStoredSetting,
  SIDEBAR_COUNTS_CHANGED,
  SIDEBAR_COUNTS_KEY,
  SIDEBAR_TABS_CHANGED,
  SIDEBAR_TABS_ORDER_KEY,
  SIDEBAR_TABS_STORAGE_KEY,
  TABS,
} from "./routes";

// Same-tab changes come as these events, other browser tabs as "storage"
const CHANGE_EVENTS = ["storage", SIDEBAR_COUNTS_CHANGED, SIDEBAR_TABS_CHANGED];

function subscribe(onChange: () => void) {
  for (const name of CHANGE_EVENTS) window.addEventListener(name, onChange);
  return () => {
    for (const name of CHANGE_EVENTS)
      window.removeEventListener(name, onChange);
  };
}

/**
 * One saved sidebar setting, read in the browser only: the server renders the defaults, so the
 * first render matches and the saved value shows right after (no hydration mismatch).
 */
const useSidebarSetting = (key: string) =>
  useSyncExternalStore(
    subscribe,
    () => readStoredSetting(key),
    () => null,
  );

/**
 * What Settings > Sidebar chose: the tabs that show, in their order, whether Projects shows, and
 * whether the counts do. Follows changes made in Settings at once.
 */
export function useSidebarPreferences() {
  const countsRaw = useSidebarSetting(SIDEBAR_COUNTS_KEY);
  const tabsRaw = useSidebarSetting(SIDEBAR_TABS_STORAGE_KEY);
  const orderRaw = useSidebarSetting(SIDEBAR_TABS_ORDER_KEY);

  const enabled = useMemo(() => parseSidebarTabs(tabsRaw), [tabsRaw]);
  const shownTabs = useMemo(() => {
    const byId = new Map(TABS.map((tab) => [tab.id, tab]));
    return parseSidebarTabsOrder(orderRaw)
      .filter((id) => enabled[id] !== false)
      .map((id) => byId.get(id)!);
  }, [orderRaw, enabled]);

  return {
    shownTabs,
    showProjects: enabled.projects !== false,
    showCounts: countsRaw !== "false",
  };
}
