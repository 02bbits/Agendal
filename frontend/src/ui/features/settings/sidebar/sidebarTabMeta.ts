import type { ComponentType } from "react";
import type { CopyKey } from "../../../copy";
import {
  CalendarIcon,
  FolderIcon,
  InboxIcon,
  NotesIcon,
} from "../../../components/icons";
import type { TabId } from "../../shell/routes";

/** How Settings > Sidebar shows each tab, with the sample count its preview shows. */
export const SIDEBAR_TAB_META: Record<
  TabId,
  {
    label: CopyKey;
    Icon: ComponentType<{ size?: number }>;
    sampleCount: number;
  }
> = {
  inbox: { label: "nav.inbox", Icon: InboxIcon, sampleCount: 5 },
  upcoming: { label: "nav.upcoming", Icon: CalendarIcon, sampleCount: 12 },
  projects: { label: "nav.projects", Icon: FolderIcon, sampleCount: 3 },
  notes: { label: "nav.notes", Icon: NotesIcon, sampleCount: 2 },
};
