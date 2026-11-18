import { useState } from "react";
import {
  DEFAULT_SIDEBAR_TABS,
  DEFAULT_SIDEBAR_TABS_ORDER,
  getStoredSidebarTabs,
  getStoredSidebarTabsOrder,
  readStoredSetting,
  SIDEBAR_TABS_ORDER_KEY,
  SIDEBAR_TABS_STORAGE_KEY,
  writeStoredSetting,
  type TabId,
} from "../../shell/routes";
import { useSortableList } from "../../shell/useSortableList";

const TABS_CHANGED_EVENT = "agendal:sidebar_tabs_changed";
const COUNTS_CHANGED_EVENT = "agendal:sidebar_counts_changed";
const SHOW_COUNTS_KEY = "agendal.sidebar_task_counts";

/**
 * The desktop sidebar's tabs as Settings > Sidebar changes them: which show, in what order, and
 * whether they show their task counts. Each change is saved in this browser and the sidebar is
 * told at once.
 */
export function useSidebarTabs() {
  const [enabled, setEnabled] = useState(getStoredSidebarTabs);
  const [order, setOrder] = useState(getStoredSidebarTabsOrder);
  const [showCounts, setShowCounts] = useState(
    () => readStoredSetting(SHOW_COUNTS_KEY) !== "false",
  );

  const saveOrder = (next: TabId[]) => {
    setOrder(next);
    writeStoredSetting(
      SIDEBAR_TABS_ORDER_KEY,
      JSON.stringify(next),
      TABS_CHANGED_EVENT,
    );
  };

  const saveEnabled = (next: Record<TabId, boolean>) => {
    setEnabled(next);
    writeStoredSetting(
      SIDEBAR_TABS_STORAGE_KEY,
      JSON.stringify(next),
      TABS_CHANGED_EVENT,
    );
  };

  const sortable = useSortableList(order, saveOrder);

  const isEnabled = (tab: TabId) => enabled[tab] !== false;
  const enabledCount = Object.values(enabled).filter(Boolean).length;
  /** The last tab showing can't be hidden: the sidebar always keeps one. */
  const isLastEnabled = (tab: TabId) => isEnabled(tab) && enabledCount <= 1;

  const toggle = (tab: TabId) => {
    if (isLastEnabled(tab)) return;
    saveEnabled({ ...enabled, [tab]: !isEnabled(tab) });
  };

  const moveBy = (index: number, step: -1 | 1) =>
    sortable.move(index, index + step);

  const reset = () => {
    saveOrder([...DEFAULT_SIDEBAR_TABS_ORDER]);
    saveEnabled({ ...DEFAULT_SIDEBAR_TABS });
  };

  const changeShowCounts = (next: boolean) => {
    setShowCounts(next);
    writeStoredSetting(SHOW_COUNTS_KEY, String(next), COUNTS_CHANGED_EVENT);
  };

  return {
    order: sortable.displayOrder,
    shownTabs: sortable.displayOrder.filter(isEnabled),
    isEnabled,
    isLastEnabled,
    toggle,
    moveBy,
    reset,
    showCounts,
    changeShowCounts,
    getItemProps: sortable.getItemProps,
    getHandleProps: sortable.getHandleProps,
  };
}
