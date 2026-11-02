import type { ReactNode } from "react";
import { t } from "../../copy";
import {
  CalendarIcon,
  FolderIcon,
  InboxIcon,
  NotesIcon,
} from "../../components/icons";
import { cx } from "../../components/cx";
import { Link } from "./Link";
import { TABS, type Navigate, type TabId } from "./routes";

const ICONS: Record<TabId, ReactNode> = {
  inbox: <InboxIcon size={22} />,
  upcoming: <CalendarIcon size={22} />,
  projects: <FolderIcon size={22} />,
  notes: <NotesIcon size={22} />,
};

export interface TabBarProps {
  active?: TabId;
  navigate?: Navigate;
}

/** Four tabs with icon and label; the active one in accent with aria-current. */
export function TabBar({ active, navigate }: TabBarProps) {
  return (
    <nav
      className="grid grid-cols-4 px-safe md:hidden border-t border-separator bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
      aria-label={t("nav.tabs")}
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          navigate={navigate}
          className={cx(
            "group focus-ring flex min-h-[62px] flex-col [@media(max-height:480px)]:min-h-12 items-center justify-center gap-0.5 rounded-field text-ink-secondary transition-colors active:text-ink",
            tab.id === active && "text-primary!",
          )}
          aria-current={tab.id === active ? "page" : undefined}
        >
          {/* A pill behind the icon: filled for the current tab, and on hover
              or press, so a tap shows at once where it went */}
          <span
            aria-hidden="true"
            className={cx(
              "inline-flex h-7 w-14 items-center justify-center rounded-full transition-[background-color,transform] duration-150 group-hover:bg-fill group-active:scale-95 group-active:bg-fill-2 motion-reduce:transition-none",
              tab.id === active && "bg-fill",
            )}
          >
            {ICONS[tab.id]}
          </span>
          <span className="text-tab font-medium">{t(tab.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
