"use client";

import {
  RouteEmptyState,
  ScreenHeader,
  t,
  type CopyKey,
  type TabId,
} from "@/ui";
import { useAppFrame } from "./AppFrame";

const TITLE: Record<TabId, CopyKey> = {
  inbox: "nav.inbox",
  upcoming: "nav.upcoming",
  projects: "nav.projects",
  notes: "nav.notes",
};

/** A tab route before its screen lands: header and the tab's empty state. */
export function TabScreen({ tab }: { tab: TabId }) {
  const { navigate } = useAppFrame();
  return (
    <>
      {/* The account initial comes from the signed-in user (AA) */}
      <ScreenHeader
        title={t(TITLE[tab])}
        accountInitial=""
        navigate={navigate}
      />
      <RouteEmptyState route={tab} />
    </>
  );
}
