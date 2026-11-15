import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { t } from "../../copy";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  FolderIcon,
  InboxIcon,
  NotesIcon,
  PlusIcon,
  SearchIcon,
} from "../../components/icons";
import { cx } from "../../components/cx";
import { Link } from "./Link";
import { AccountMenu } from "./AccountMenu";
import type { SettingsTab, ThemeSetting } from "./AccountScreen";
import {
  ROUTES,
  SIDEBAR_TABS_ORDER_KEY,
  SIDEBAR_TABS_STORAGE_KEY,
  TABS,
  parseSidebarTabs,
  parseSidebarTabsOrder,
  readStoredSetting,
  type Navigate,
  type TabId,
} from "./routes";

const SIDEBAR_COUNTS_KEY = "agendal.sidebar_task_counts";

const noStoredSetting = () => null;

// Same-tab changes come as these events, other tabs as "storage"
function subscribeSidebarSettings(onChange: () => void) {
  const events = [
    "storage",
    "agendal:sidebar_counts_changed",
    "agendal:sidebar_tabs_changed",
  ];
  for (const name of events) window.addEventListener(name, onChange);
  return () => {
    for (const name of events) window.removeEventListener(name, onChange);
  };
}

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
}: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFromKeyboard, setMenuFromKeyboard] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [projectsOpen, setProjectsOpen] = useState(true);
  // Saved settings are read in the browser only: the server renders the defaults, so the first
  // render matches and the saved values show right after (no hydration mismatch)
  const countsRaw = useSyncExternalStore(
    subscribeSidebarSettings,
    () => readStoredSetting(SIDEBAR_COUNTS_KEY),
    noStoredSetting,
  );
  const tabsRaw = useSyncExternalStore(
    subscribeSidebarSettings,
    () => readStoredSetting(SIDEBAR_TABS_STORAGE_KEY),
    noStoredSetting,
  );
  const orderRaw = useSyncExternalStore(
    subscribeSidebarSettings,
    () => readStoredSetting(SIDEBAR_TABS_ORDER_KEY),
    noStoredSetting,
  );
  const showCounts = countsRaw !== "false";
  const enabledTabs = useMemo(() => parseSidebarTabs(tabsRaw), [tabsRaw]);
  const tabOrder = useMemo(() => parseSidebarTabsOrder(orderRaw), [orderRaw]);

  const sortedTabs = useMemo(() => {
    const tabMap = new Map<TabId, (typeof TABS)[number]>(
      TABS.map((t) => [t.id, t]),
    );
    return tabOrder
      .map((id) => tabMap.get(id))
      .filter((t): t is (typeof TABS)[number] => Boolean(t));
  }, [tabOrder]);

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
        {sortedTabs
          .filter((tab: (typeof TABS)[number]) => enabledTabs[tab.id] !== false)
          .map((tab: (typeof TABS)[number]) => {
            const current = tab.id === active;
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
                    {ICONS[tab.id]}
                  </span>
                  <span className="flex-1">{t(tab.label)}</span>
                  {showCounts && counts?.[tab.id] !== undefined && (
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
                  )}
                </Link>
              </li>
            );
          })}
      </ul>

      {projects && enabledTabs.projects !== false && (
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

      <div className="relative mt-auto">
        {menuOpen && (
          <AccountMenu
            accountName={accountName}
            email={email ?? ""}
            theme={theme ?? "system"}
            onThemeChange={(newTheme) => onThemeChange?.(newTheme)}
            onOpenSettings={(tab) => {
              setMenuOpen(false);
              onAccount?.(tab);
            }}
            onSignOut={() => {
              setMenuOpen(false);
              onSignOut?.();
            }}
            onClose={() => {
              setMenuOpen(false);
              triggerRef.current?.focus();
            }}
            triggerRef={triggerRef}
            focusFirst={menuFromKeyboard}
          />
        )}
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            // detail 0: Enter or Space, so the menu starts on its first item
            setMenuFromKeyboard(e.detail === 0);
            setMenuOpen((open) => !open);
          }}
          onKeyDown={(e) => {
            if (!menuOpen && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
              e.preventDefault();
              setMenuFromKeyboard(true);
              setMenuOpen(true);
            }
          }}
          className="focus-ring row-hover flex min-h-14 w-full items-center gap-3 rounded-field px-2 text-ink text-left cursor-pointer border-0 bg-transparent"
        >
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-footnote font-semibold"
            aria-hidden="true"
          >
            {accountName.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-callout font-semibold">
              {accountName}
            </span>
            <span className="text-footnote text-ink-secondary">
              {t("nav.account")}
            </span>
          </span>
          <span className="text-ink-tertiary shrink-0" aria-hidden="true">
            {menuOpen ? (
              <ChevronUpIcon size={16} />
            ) : (
              <ChevronDownIcon size={16} />
            )}
          </span>
        </button>
      </div>
    </nav>
  );
}
