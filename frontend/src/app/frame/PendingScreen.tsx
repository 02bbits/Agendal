import { LoadingScreen, t } from "@/ui";
import { readViewMode } from "@/ui/features/lists/storage";
import {
  InboxSkeleton,
  ProjectSkeleton,
  ProjectsSkeleton,
  UpcomingSkeleton,
} from "../skeletons";
import { TabPending } from "../TabLoading";
import { headerDate } from "../headerDate";
import { TAB_TITLE } from "./frameRoutes";
import type { PendingTab } from "./useTabNavigation";
import { useAppFrame } from "./AppFrameContext";

/** What a tapped screen shows under its header until its page is there (#161). */
function pendingBody(pending: PendingTab, logo: boolean) {
  if (logo) return <LoadingScreen inline />;
  if (pending.project) return <ProjectSkeleton />;
  switch (pending.tab) {
    case "inbox":
      return <InboxSkeleton />;
    case "projects":
      return <ProjectsSkeleton />;
    case "upcoming":
      return <UpcomingSkeleton board={readViewMode() === "board"} />;
    default:
      // Notes keeps its own screen: a plain list skeleton until it is there
      return <InboxSkeleton />;
  }
}

/**
 * A tapped tab or project until its page arrives: the header that screen will show (a project
 * brings its own inside its skeleton), then its skeleton, or the loading screen for a phone's
 * first visit to a tab.
 */
export function PendingScreen({
  pending,
  wide,
}: {
  pending: PendingTab;
  wide: boolean;
}) {
  const { navigate, user } = useAppFrame();
  return (
    <TabPending
      title={pending.project ? undefined : t(TAB_TITLE[pending.tab])}
      overline={pending.project ? undefined : headerDate()}
      accountInitial={user?.display_name || user?.email || ""}
      navigate={navigate}
      body={pendingBody(
        pending,
        !wide && pending.firstVisit && !pending.project,
      )}
    />
  );
}
