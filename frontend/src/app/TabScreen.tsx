"use client";

import { useSyncExternalStore } from "react";
import {
  RouteEmptyState,
  ScreenHeader,
  t,
  type CopyKey,
  type TabId,
} from "@/ui";
import { headerDate } from "@/lib/clock";
import { useAppFrame } from "./AppFrame";

const TITLE: Record<TabId, CopyKey> = {
  inbox: "nav.inbox",
  upcoming: "nav.upcoming",
  projects: "nav.projects",
  notes: "nav.notes",
};

const noSubscription = () => () => {};

/** A tab route before its screen lands: header and the tab's empty state. */
export function TabScreen({ tab }: { tab: TabId }) {
  const { navigate, user } = useAppFrame();
  // Inbox shows today's date (screens.md). Empty on the server: the page is prerendered at build time
  const date = useSyncExternalStore(
    noSubscription,
    () => (tab === "inbox" ? headerDate() : undefined),
    () => undefined,
  );

  return (
    <>
      <ScreenHeader
        overline={date}
        title={t(TITLE[tab])}
        accountInitial={user?.display_name || user?.email || ""}
        navigate={navigate}
      />
      <RouteEmptyState route={tab} />
    </>
  );
}
