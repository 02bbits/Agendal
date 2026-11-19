import type { CopyKey } from "../../../copy";
import type { TabId } from "../../shell/routes";

/** How Settings > Sidebar labels each tab, with the sample count its preview shows. */
export const SIDEBAR_TAB_META: Record<
  TabId,
  { label: CopyKey; sampleCount: number }
> = {
  inbox: { label: "nav.inbox", sampleCount: 5 },
  upcoming: { label: "nav.upcoming", sampleCount: 12 },
  projects: { label: "nav.projects", sampleCount: 3 },
  notes: { label: "nav.notes", sampleCount: 2 },
};
