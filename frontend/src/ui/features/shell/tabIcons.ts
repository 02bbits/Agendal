import type { ComponentType } from "react";
import {
  CalendarIcon,
  FolderIcon,
  InboxIcon,
  NotesIcon,
} from "../../components/icons";
import type { TabId } from "./routes";

/** Each tab's icon, the same in the tab bar, the sidebar and Settings > Sidebar. */
export const TAB_ICON: Record<TabId, ComponentType<{ size?: number }>> = {
  inbox: InboxIcon,
  upcoming: CalendarIcon,
  projects: FolderIcon,
  notes: NotesIcon,
};
