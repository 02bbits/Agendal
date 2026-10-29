import type { ReactNode } from "react";
import { t } from "../../copy";
import {
  CalendarIcon,
  FolderIcon,
  InboxIcon,
  PencilIcon,
} from "../../components/icons";
import { cx } from "../../components/cx";
import { Link } from "./Link";
import { TABS, type Navigate, type TabId } from "./routes";

const ICONS: Record<TabId, ReactNode> = {
  inbox: <InboxIcon size={22} />,
  upcoming: <CalendarIcon size={22} />,
  projects: <FolderIcon size={22} />,
  notes: <PencilIcon size={22} />,
};

export interface TabBarProps {
  active?: TabId;
  navigate?: Navigate;
}

/** Four tabs with icon and label; the active one in accent with aria-current. */
export function TabBar({ active, navigate }: TabBarProps) {
  return (
    <nav
      className="grid grid-cols-4 border-t border-separator bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
      aria-label={t("nav.tabs")}
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          navigate={navigate}
          className={cx(
            "focus-ring flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-field text-ink-secondary",
            tab.id === active && "text-primary!",
          )}
          aria-current={tab.id === active ? "page" : undefined}
        >
          <span aria-hidden="true">{ICONS[tab.id]}</span>
          <span className="text-tab font-medium">{t(tab.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
