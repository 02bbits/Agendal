import { useState, type ReactNode } from "react";
import { t } from "../../copy";
import {
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
} from "../../components/icons";
import { cx } from "../../components/cx";
import type { SettingsTab, ThemeSetting } from "../settings/types";
import { Link } from "./Link";
import { ROUTES, type Navigate, type TabId } from "./routes";
import { SidebarAccount } from "./SidebarAccount";
import { TAB_ICON } from "./tabIcons";
import { useSidebarPreferences } from "./useSidebarPreferences";

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
  /** Callback to open account / settings popup. */
  onAccount?: (tab?: SettingsTab) => void;
  /** The signed-in user's name; the avatar shows its first letter. */
  accountName: string;
  /** The signed-in user's email. */
  email?: string;
  /** Current theme setting. */
  theme?: ThemeSetting;
  /** Setter for theme setting. */
  onThemeChange?: (theme: ThemeSetting) => void;
  /** Callback to sign out. */
  onSignOut?: () => void;
  /** Sign out on all devices, offered in the Sign out dialog. */
  onSignOutEverywhere?: () => void;
  /** While this browser can install the app (AP-1): in the account menu above Sign out. */
  onInstall?: () => void;
}

/** Sidebar from 768px wide, in place of the tab bar (UX-27). */
export function Sidebar({
  active,
  navigate,
  counts,
  projects,
  onNewProject,
  onSearch,
  onAccount,
  accountName,
  email,
  theme,
  onThemeChange,
  onSignOut,
  onSignOutEverywhere,
  onInstall,
}: SidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const { shownTabs, showProjects, showCounts } = useSidebarPreferences();

  return (
    // One landmark for the whole sidebar, so the mark, Search and Account are inside it
    <nav
      aria-label={t("nav.sidebar")}
      className="flex h-full flex-col gap-4 pt-5 pr-3 pb-[calc(12px+env(safe-area-inset-bottom))] pl-[calc(12px+env(safe-area-inset-left))]"
    >
      {/* The mark goes home to Inbox */}
      <Link
        href={ROUTES.inbox}
        navigate={navigate}
        className="focus-ring mt-1 mb-4 flex items-center gap-2.5 self-start rounded-field px-2 text-title font-bold text-ink no-underline"
      >
        <span
          className="inline-flex size-8 items-center justify-center rounded-tile bg-neutral text-neutral-content"
          aria-hidden="true"
        >
          <CheckIcon size={18} strokeWidth={2.25} />
        </span>
        {t("app.name")}
      </Link>

      <button
        type="button"
        onClick={onSearch}
        className="focus-ring flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-field border border-transparent bg-fill px-3 text-left text-callout text-ink-tertiary shadow-none transition-all duration-150 hover:border-separator hover:bg-fill-2/70 hover:text-ink hover:shadow-xs motion-reduce:transition-none"
      >
        <SearchIcon size={18} className="shrink-0 transition-colors" />
        <span className="flex-1 truncate">{t("search.placeholder")}</span>
      </button>

      <ul className="m-0 -mt-1.5 flex list-none flex-col gap-0.5 p-0">
        {shownTabs.map((tab) => {
          const current = tab.id === active;
          const Icon = TAB_ICON[tab.id];
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                navigate={navigate}
                className={cx(
                  "focus-ring row-hover flex min-h-10 items-center gap-3 rounded-field px-3 text-body transition-colors",
                  current
                    ? "bg-primary/15! text-primary! font-semibold"
                    : "text-ink-secondary hover:bg-fill/60 hover:text-ink",
                )}
                aria-current={current ? "page" : undefined}
              >
                <span
                  className={cx("inline-flex", current && "text-primary")}
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </span>
                <span className="flex-1">{t(tab.label)}</span>
                {showCounts && counts?.[tab.id] ? (
                  <span
                    className={cx(
                      "text-footnote tabular-nums",
                      current
                        ? "text-primary font-semibold"
                        : "text-ink-tertiary",
                    )}
                  >
                    {counts[tab.id]}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {projects && showProjects && (
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
            {/* -mr-2 puts the cross (narrower than its 14px box) on the rows' count column */}
            {onNewProject && (
              <button
                type="button"
                onClick={onNewProject}
                className="-mr-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-ink-tertiary transition-colors hover:bg-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={t("project.new")}
              >
                <PlusIcon size={14} />
              </button>
            )}
          </div>
          {projectsOpen && projects}
        </section>
      )}

      <SidebarAccount
        accountName={accountName}
        email={email}
        theme={theme}
        onThemeChange={onThemeChange}
        onAccount={onAccount}
        onSignOut={onSignOut}
        onSignOutEverywhere={onSignOutEverywhere}
        onInstall={onInstall}
      />
    </nav>
  );
}
