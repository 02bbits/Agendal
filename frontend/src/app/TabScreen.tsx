"use client";

import { Button, RouteEmptyState, ScreenHeader, t, type TabId } from "@/ui";
import { useHeaderDate } from "./headerDate";
import { TAB_TITLE } from "./frame/frameRoutes";
import { useAppFrame } from "./AppFrame";

/** A tab route before its screen lands: header and the tab's empty state. */
export function TabScreen({ tab }: { tab: TabId }) {
  const { navigate, user, openNoteEditor } = useAppFrame();
  // Inbox shows today's date (screens.md). Empty on the server: the page is prerendered at build time
  const today = useHeaderDate();
  const date = tab === "inbox" ? today : undefined;

  return (
    <>
      <ScreenHeader
        overline={date}
        title={t(TAB_TITLE[tab])}
        accountInitial={user?.display_name || user?.email || ""}
        navigate={navigate}
      />
      <RouteEmptyState
        route={tab}
        action={
          tab === "notes" && (
            <Button variant="primary" onClick={openNoteEditor}>
              {t("note.capture_open")}
            </Button>
          )
        }
      />
    </>
  );
}
