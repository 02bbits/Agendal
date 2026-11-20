"use client";

import { useSyncExternalStore } from "react";
import { readViewMode } from "@/ui/features/lists/storage";
import { ScreenHeader, t } from "@/ui";
import { useAppFrame } from "./AppFrame";
import { useHeaderDate } from "./headerDate";
import { ProjectsSkeleton, UpcomingSkeleton } from "./skeletons";

const noSubscription = () => () => {};
const readBoard = () => readViewMode() === "board";

/**
 * What a tab route shows while its own code loads (its Suspense fallback, #161): the tab's
 * header and skeleton, the same the tap showed, so the screen never goes blank in between.
 */
export function TabFallback({ tab }: { tab: "upcoming" | "projects" }) {
  const { navigate, user } = useAppFrame();
  // Read on the client only: the server can't know the date here or the saved view
  const date = useHeaderDate();
  const board = useSyncExternalStore(noSubscription, readBoard, () => false);
  return (
    <>
      <ScreenHeader
        overline={date}
        title={t(tab === "upcoming" ? "nav.upcoming" : "nav.projects")}
        accountInitial={user?.display_name || user?.email || ""}
        navigate={navigate}
      />
      {tab === "upcoming" ? (
        <UpcomingSkeleton board={board} />
      ) : (
        <ProjectsSkeleton />
      )}
    </>
  );
}
