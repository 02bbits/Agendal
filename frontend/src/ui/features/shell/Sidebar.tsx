import type { ReactNode } from "react";
import { t } from "../../copy";
import {
  CalendarIcon,
  CheckIcon,
  FolderIcon,
  InboxIcon,
  PencilIcon,
  SearchIcon,
} from "../../components/icons";
import { cx } from "../../components/cx";
import { Link } from "./Link";
import { ROUTES, TABS, type Navigate, type TabId } from "./routes";

const ICONS: Record<TabId, ReactNode> = {
  inbox: <InboxIcon size={20} />,
  upcoming: <CalendarIcon size={20} />,
  projects: <FolderIcon size={20} />,
  notes: <PencilIcon size={20} />,
};

export interface SidebarProps {
  active?: TabId;
  navigate?: Navigate;
  /** Open tasks per tab, shown at the end of each row (LV fills them). */
  counts?: Partial<Record<TabId, number>>;
  /** The project rows under "Projects" (PJ fills them). */
  projects?: ReactNode;
  /** The signed-in user's name; the avatar shows its first letter. */
  accountName: string;
}

/** Sidebar from 768px wide, in place of the tab bar (UX-27). */
export function Sidebar({
  active,
  navigate,
  counts,
  projects,
  accountName,
}: SidebarProps) {
  return (
    // One landmark for the whole sidebar, so the mark, Search and Account are inside it
    <nav
      aria-label={t("nav.sidebar")}
      className="flex h-full flex-col gap-4 pt-5 pr-3 pb-[calc(12px+env(safe-area-inset-bottom))] pl-[calc(12px+env(safe-area-inset-left))]"
    >
      <p className="m-0 flex items-center gap-2.5 px-2 font-serif text-title font-semibold text-ink">
        <span
          className="inline-flex size-8 items-center justify-center rounded-tile bg-neutral text-neutral-content"
          aria-hidden="true"
        >
          <CheckIcon size={18} strokeWidth={2.25} />
        </span>
        {t("app.name")}
      </p>

      <Link
        href={ROUTES.search}
        navigate={navigate}
        className="focus-ring flex min-h-10 items-center gap-2 rounded-field bg-fill px-3 text-callout text-ink-tertiary"
      >
        <SearchIcon size={18} />
        {t("search.placeholder")}
      </Link>

      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {TABS.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                navigate={navigate}
                className={cx(
                  "focus-ring flex min-h-10 items-center gap-3 rounded-field px-3 text-body text-ink hover:bg-fill",
                  current && "bg-primary-tint! font-semibold text-primary!",
                )}
                aria-current={current ? "page" : undefined}
              >
                <span className="inline-flex" aria-hidden="true">
                  {ICONS[tab.id]}
                </span>
                <span className="flex-1">{t(tab.label)}</span>
                {counts?.[tab.id] !== undefined && (
                  <span
                    className={cx(
                      "text-footnote tabular-nums",
                      current ? "text-primary" : "text-ink-tertiary",
                    )}
                  >
                    {counts[tab.id]}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {projects && (
        <section className="min-h-0 flex-1 overflow-y-auto">
          <h2 className="m-0 px-3 pt-2 pb-1 text-overline font-semibold uppercase text-ink-tertiary">
            {t("nav.projects")}
          </h2>
          {projects}
        </section>
      )}

      <Link
        href={ROUTES.account}
        navigate={navigate}
        className="focus-ring mt-auto flex min-h-14 items-center gap-3 rounded-field px-2 text-ink hover:bg-fill"
      >
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-footnote font-semibold"
          aria-hidden="true"
        >
          {accountName.slice(0, 1).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-callout font-semibold">
            {accountName}
          </span>
          <span className="text-footnote text-ink-secondary">
            {t("nav.account")}
          </span>
        </span>
      </Link>
    </nav>
  );
}
