import { useState, type ReactNode } from "react";
import { t } from "../../copy";
import {
  CalendarIcon,
  CheckIcon,
  FolderIcon,
  InboxIcon,
  NotesIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
} from "../../components/icons";
import { cx } from "../../components/cx";
import { Link } from "./Link";
import { ROUTES, TABS, type Navigate, type TabId } from "./routes";

const ICONS: Record<TabId, ReactNode> = {
  inbox: <InboxIcon size={20} />,
  upcoming: <CalendarIcon size={20} />,
  projects: <FolderIcon size={20} />,
  notes: <NotesIcon size={20} />,
};

export interface SidebarProps {
  active?: TabId;
  navigate?: Navigate;
  /** Open tasks per tab, shown at the end of each row (LV fills them). */
  counts?: Partial<Record<TabId, number>>;
  /** The project rows under "Projects" (PJ fills them). */
  projects?: ReactNode;
  /** Callback to create a new project from the PROJECTS header button. */
  onNewProject?: () => void;
  /** Callback to open search. */
  onSearch?: () => void;
  /** The signed-in user's name; the avatar shows its first letter. */
  accountName: string;
}

/** Sidebar from 768px wide, in place of the tab bar (UX-27). */
export function Sidebar({
  active,
  navigate,
  counts,
  projects,
  onNewProject,
  onSearch,
  accountName,
}: SidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  return (
    // One landmark for the whole sidebar, so the mark, Search and Account are inside it
    <nav
      aria-label={t("nav.sidebar")}
      className="flex h-full flex-col gap-4 pt-5 pr-3 pb-[calc(12px+env(safe-area-inset-bottom))] pl-[calc(12px+env(safe-area-inset-left))]"
    >
      <p className="m-0 flex items-center gap-2.5 px-2 text-title font-bold text-ink">
        <span
          className="inline-flex size-8 items-center justify-center rounded-tile bg-neutral text-neutral-content"
          aria-hidden="true"
        >
          <CheckIcon size={18} strokeWidth={2.25} />
        </span>
        {t("app.name")}
      </p>

      <button
        type="button"
        onClick={onSearch}
        className="focus-ring flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-field border border-transparent bg-fill px-3 text-left text-callout text-ink-tertiary shadow-none transition-all duration-150 hover:border-separator hover:bg-fill-2/70 hover:text-ink hover:shadow-xs motion-reduce:transition-none"
      >
        <SearchIcon size={18} className="shrink-0 transition-colors" />
        <span className="flex-1 truncate">{t("search.placeholder")}</span>
      </button>

      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {TABS.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                navigate={navigate}
                className={cx(
                  "focus-ring row-hover flex min-h-10 items-center gap-3 rounded-field px-3 text-body text-ink-secondary",
                  current && "bg-primary-tint! text-ink!",
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
                      current ? "text-ink" : "text-ink-tertiary",
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
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <h2 className="m-0 text-overline font-semibold uppercase">
              <button
                type="button"
                aria-expanded={projectsOpen}
                onClick={() => setProjectsOpen(!projectsOpen)}
                className="focus-ring inline-flex cursor-pointer items-center gap-1 uppercase border-0 bg-transparent p-0 text-ink-tertiary hover:text-ink"
              >
                <span className="link-swipe">{t("nav.projects")}</span>
                <ChevronRightIcon
                  size={12}
                  className={cx(
                    "transition-transform duration-150 motion-reduce:transition-none",
                    projectsOpen && "rotate-90",
                  )}
                />
              </button>
            </h2>
            {onNewProject && (
              <button
                type="button"
                onClick={onNewProject}
                className="-mr-[5px] inline-flex size-6 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-ink-tertiary transition-colors hover:bg-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={t("project.new")}
              >
                <PlusIcon size={14} />
              </button>
            )}
          </div>
          {projectsOpen && projects}
        </section>
      )}

      <Link
        href={ROUTES.account}
        navigate={navigate}
        className="focus-ring row-hover mt-auto flex min-h-14 items-center gap-3 rounded-field px-2 text-ink"
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
