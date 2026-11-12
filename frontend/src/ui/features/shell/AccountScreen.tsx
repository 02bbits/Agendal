import {
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import { useBackgroundScrollLock } from "../../components/useBackgroundScrollLock";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloudIcon,
  FolderIcon,
  GripVerticalIcon,
  InboxIcon,
  NotesIcon,
  PaletteIcon,
  PlugIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SidebarIcon,
  SlidersIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from "../../components/icons";
import { Segmented } from "../../components/Segmented";
import { SelectDropdown } from "../../components/SelectDropdown";
import { Switch } from "../../components/Switch";
import { ALL_THEME_PALETTES, applyThemePalette } from "../../domain/theme";
import { runThemeTransition } from "../../domain/themeTransition";
import type { TimeFormat, WeekStart } from "../../domain/types";
import { timeZone as getDeviceTimeZone } from "../../../lib/clock";
import { ChangePassword } from "./ChangePassword";
import {
  DEFAULT_SIDEBAR_TABS_ORDER,
  getStoredSidebarTabs,
  getStoredSidebarTabsOrder,
  SIDEBAR_TABS_ORDER_KEY,
  SIDEBAR_TABS_STORAGE_KEY,
  type TabId,
} from "./routes";
import { useMediaQuery } from "../tasks/useMediaQuery";
import { useSortableList } from "./useSortableList";

export type ThemeSetting = "system" | "light" | "dark";
export type PageViewMode = "flat" | "full";

export type SettingsTab =
  | "account"
  | "general"
  | "subscription"
  | "theme"
  | "sidebar"
  | "quick_add"
  | "productivity"
  | "reminders"
  | "notifications"
  | "backups"
  | "integrations"
  | "calendars";

export interface AccountSettings {
  theme: ThemeSetting;
  weekStart: WeekStart;
  timeFormat: TimeFormat;
  rememberDevice: boolean;
  pageView?: PageViewMode;
  timezone?: string;
  timezoneAuto?: boolean;
}

export interface AccountScreenProps {
  name: string;
  email: string;
  settings: AccountSettings;
  /** Saving goes through `PATCH /me` (IM-16, platform owner). */
  onChange: (patch: Partial<AccountSettings>) => void;
  onBack: () => void;
  onSignOut: () => void;
  /** Should; omitted until AA ships it. */
  onSignOutEverywhere?: () => void;
  /** Shown when the app can be installed (AP-1). */
  onInstall?: () => void;
  /** Reminders permission state text, e.g. "Allowed" (TK-6, Should). */
  remindersStatus?: string;
  notificationSupported?: boolean;
  notificationPermission?: NotificationPermission;
  vapidConfigured?: boolean | null;
  onEnableNotifications?: () => void;
  onSendTestNotification?: () => void;
  initialTab?: SettingsTab;
  onUpdateName?: { (name: string): Promise<void> };
  portal?: boolean;
}

const noSubscribe = () => () => {};

function inBrowser() {
  return true;
}

function onServer() {
  return false;
}

export function AccountScreen({
  name,
  email,
  settings,
  onChange,
  onBack,
  onSignOut,
  onSignOutEverywhere,
  onInstall,
  remindersStatus,
  notificationSupported = true,
  notificationPermission = "default",
  vapidConfigured = null,
  onEnableNotifications,
  onSendTestNotification,
  initialTab = "general",
  onUpdateName,
  portal = false,
}: AccountScreenProps): ReactElement | null {
  const mounted = useSyncExternalStore(noSubscribe, inBrowser, onServer);

  const isDesktop =
    useMediaQuery("(min-width: 768px)") ||
    (typeof window !== "undefined" && !window.matchMedia);

  const [tab, setTab] = useState<SettingsTab>(
    initialTab === "subscription" ? "general" : initialTab,
  );
  const [phoneView, setPhoneView] = useState<"list" | SettingsTab>("list");
  const detailHistoryPushed = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [prevName, setPrevName] = useState(name);
  const [displayName, setDisplayName] = useState(name);
  if (name !== prevName) {
    setPrevName(name);
    setDisplayName(name);
  }
  const [language, setLanguage] = useState("en");
  const [homeView, setHomeView] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem("agendal.home_view") || "inbox"
        : "inbox";
    } catch {
      return "inbox";
    }
  });
  const [subView, setSubView] = useState<"change_password" | null>(null);
  const [dateFormat, setDateFormat] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem("agendal.date_format") || "DD-MM-YYYY"
        : "DD-MM-YYYY";
    } catch {
      return "DD-MM-YYYY";
    }
  });
  const [nextWeekDay, setNextWeekDay] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem("agendal.next_week_day") || "mon"
        : "mon";
    } catch {
      return "mon";
    }
  });
  const [weekendDay, setWeekendDay] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem("agendal.weekend_day") || "sat"
        : "sat";
    } catch {
      return "sat";
    }
  });
  const [smartDateRecognition, setSmartDateRecognition] = useState(true);
  const [syncTheme, setSyncTheme] = useState(true);
  const [activePalette, setActivePalette] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem("agendal.theme_palette") || "default"
        : "default";
    } catch {
      return "default";
    }
  });
  const [showTaskCounts, setShowTaskCounts] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem("agendal.sidebar_task_counts") !== "false"
        : true;
    } catch {
      return true;
    }
  });
  const [sidebarTabs, setSidebarTabs] = useState(getStoredSidebarTabs);
  const [sidebarOrder, setSidebarOrder] = useState(getStoredSidebarTabsOrder);
  const [ripplingId, setRipplingId] = useState<string | null>(null);

  const {
    displayOrder: sortableSidebarOrder,
    getItemProps,
    getHandleProps,
    move: moveSortableSidebarTab,
  } = useSortableList(sidebarOrder, (nextOrder) => {
    setSidebarOrder(nextOrder);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SIDEBAR_TABS_ORDER_KEY, JSON.stringify(nextOrder));
      }
    } catch {}
    window.dispatchEvent(new Event("agendal:sidebar_tabs_changed"));
  });

  const toggleSidebarTab = (tabId: TabId) => {
    const isCurrentlyEnabled = sidebarTabs[tabId] !== false;
    const enabledCount = Object.values(sidebarTabs).filter(Boolean).length;
    // Keep at least one tab enabled
    if (isCurrentlyEnabled && enabledCount <= 1) return;

    const next = {
      ...sidebarTabs,
      [tabId]: !isCurrentlyEnabled,
    };
    setSidebarTabs(next);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SIDEBAR_TABS_STORAGE_KEY, JSON.stringify(next));
      }
    } catch {}
    window.dispatchEvent(new Event("agendal:sidebar_tabs_changed"));
  };

  const moveSidebarTab = (index: number, direction: "up" | "down") => {
    moveSortableSidebarTab(index, direction === "up" ? index - 1 : index + 1);
  };

  const resetSidebarNavigation = () => {
    const defaultOrder = [...DEFAULT_SIDEBAR_TABS_ORDER];
    const defaultEnabled = {
      inbox: true,
      upcoming: true,
      projects: true,
      notes: true,
    };
    setSidebarOrder(defaultOrder);
    setSidebarTabs(defaultEnabled);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          SIDEBAR_TABS_ORDER_KEY,
          JSON.stringify(defaultOrder),
        );
        localStorage.setItem(
          SIDEBAR_TABS_STORAGE_KEY,
          JSON.stringify(defaultEnabled),
        );
      }
    } catch {}
    window.dispatchEvent(new Event("agendal:sidebar_tabs_changed"));
  };

  const openDetail = (tabId: SettingsTab) => {
    setTab(tabId);
    setSubView(null);
    setPhoneView(tabId);
    if (typeof window !== "undefined") {
      try {
        window.history.pushState(
          { ...window.history.state, settingsDetail: true },
          "",
        );
        detailHistoryPushed.current = true;
      } catch {}
    }
  };

  const backToList = useCallback(() => {
    if (subView === "change_password") {
      setSubView(null);
      return;
    }
    if (detailHistoryPushed.current) {
      detailHistoryPushed.current = false;
      if (
        typeof window !== "undefined" &&
        window.history.state?.settingsDetail
      ) {
        try {
          window.history.back();
        } catch {}
      }
    }
    setPhoneView("list");
  }, [subView]);

  const handleClose = useCallback(() => {
    if (detailHistoryPushed.current) {
      detailHistoryPushed.current = false;
      if (
        typeof window !== "undefined" &&
        window.history.state?.settingsDetail
      ) {
        try {
          window.history.back();
        } catch {}
      }
    }
    onBack();
  }, [onBack]);

  useEffect(() => {
    const onPopState = () => {
      if (phoneView !== "list") {
        detailHistoryPushed.current = false;
        if (subView === "change_password") {
          setSubView(null);
        }
        setPhoneView("list");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [phoneView, subView]);

  useEffect(() => {
    return () => {
      if (detailHistoryPushed.current) {
        detailHistoryPushed.current = false;
        if (
          typeof window !== "undefined" &&
          window.history.state?.settingsDetail
        ) {
          try {
            window.history.back();
          } catch {}
        }
      }
    };
  }, []);

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useBackgroundScrollLock(modalRef);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isDesktop && phoneView !== "list") {
          backToList();
        } else if (subView === "change_password") {
          setSubView(null);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDesktop, phoneView, subView, handleClose, backToList]);

  const deviceZone = getDeviceTimeZone();
  const timeZoneOptions = useMemo(() => {
    const supported =
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [
            "UTC",
            "Asia/Ho_Chi_Minh",
            "America/New_York",
            "Europe/London",
            "Asia/Tokyo",
          ];
    return [
      {
        value: "auto",
        label: t("settings.time_zone_auto", { zone: deviceZone }),
      },
      ...supported.map((z) => ({ value: z, label: z })),
    ];
  }, [deviceZone]);

  const allTabs: Array<{
    id: SettingsTab;
    label: string;
    icon: ReactElement;
    keywords: string;
  }> = [
    {
      id: "account",
      label: t("settings.tab_account"),
      icon: <UserIcon size={17} />,
      keywords: "account name email photo plan password beginner",
    },
    {
      id: "general",
      label: t("app.tab_general"),
      icon: <SlidersIcon size={17} />,
      keywords: "general time format week start page view device sign out",
    },
    {
      id: "theme",
      label: t("settings.tab_theme"),
      icon: <PaletteIcon size={17} />,
      keywords: "theme appearance dark light color",
    },
    {
      id: "sidebar",
      label: t("settings.tab_sidebar"),
      icon: <SidebarIcon size={17} />,
      keywords: "sidebar navigation projects tabs counts",
    },
    {
      id: "quick_add",
      label: t("settings.tab_quick_add"),
      icon: <PlusIcon size={17} />,
      keywords: "quick add task shortcut default project",
    },
    {
      id: "productivity",
      label: t("settings.tab_productivity"),
      icon: <CheckCircleIcon size={17} />,
      keywords: "productivity streak karma goal completed",
    },
    {
      id: "reminders",
      label: t("settings.tab_reminders"),
      icon: <ClockIcon size={17} />,
      keywords: "reminders notifications alarm alert due schedule",
    },
    {
      id: "notifications",
      label: t("app.tab_notifications"),
      icon: <BellIcon size={17} />,
      keywords: "notifications push browser permission vapid alert",
    },
    {
      id: "backups",
      label: t("settings.tab_backups"),
      icon: <CloudIcon size={17} />,
      keywords: "backups export import json csv cloud sync",
    },
    {
      id: "integrations",
      label: t("settings.tab_integrations"),
      icon: <PlugIcon size={17} />,
      keywords: "integrations api webhooks calendar sync zapier",
    },
    {
      id: "calendars",
      label: t("settings.tab_calendars"),
      icon: <CalendarIcon size={17} />,
      keywords: "calendars google outlook feed ical sync",
    },
  ];

  const query = searchQuery.trim().toLowerCase();
  const visibleTabs = query
    ? allTabs.filter(
        (tItem) =>
          tItem.label.toLowerCase().includes(query) ||
          tItem.keywords.toLowerCase().includes(query),
      )
    : allTabs;

  const onTabKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + visibleTabs.length) % visibleTabs.length;
    setTab(visibleTabs[next]!.id);
    tabRefs.current[next]?.focus();
  };

  const handleNameBlur = () => {
    if (displayName.trim() && displayName !== name && onUpdateName) {
      onUpdateName(displayName.trim()).catch(() => {});
    }
  };

  const activeTabId = !isDesktop && phoneView !== "list" ? phoneView : tab;
  const currentTabObj = allTabs.find(function isCurrent(tItem) {
    return tItem.id === activeTabId;
  });

  const renderTabContent = (activeTab: SettingsTab) => {
    return subView === "change_password" ? (
      <ChangePassword email={email} onBack={() => setSubView(null)} />
    ) : (
      <>
        {/* TAB: ACCOUNT */}
        <div
          className={cx(
            "space-y-6 max-w-[620px]",
            activeTab === "account"
              ? "opacity-100"
              : "opacity-0 pointer-events-none absolute h-0 overflow-hidden",
          )}
        >
          {/* Plan */}
          <section>
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-1">
              {t("settings.plan_heading")}
            </h2>
            <div className="flex items-center justify-between py-1">
              <span className="text-body font-semibold text-ink">
                {t("settings.plan_beginner")}
              </span>
              <Button variant="secondary" size="sm" className="rounded-lg">
                {t("settings.manage_plan")}
              </Button>
            </div>
          </section>

          {/* Photo */}
          <section>
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
              {t("settings.photo_heading")}
            </h2>
            <div className="flex items-center gap-4">
              <span
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[#00897b] text-white text-xl font-bold shadow-xs"
                aria-hidden="true"
              >
                {displayName ? displayName.slice(0, 1).toUpperCase() : "T"}
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="rounded-lg">
                    {t("settings.change_photo")}
                  </Button>
                  <button
                    type="button"
                    className="rounded-lg border border-error/40 px-3 py-1.5 text-footnote font-medium text-error hover:bg-error/10 transition-colors cursor-pointer"
                  >
                    {t("settings.remove_photo")}
                  </button>
                </div>
                <p className="m-0 text-caption text-ink-tertiary">
                  {t("settings.photo_max_size")}
                </p>
                <p className="m-0 text-caption text-ink-tertiary">
                  {t("settings.photo_public")}
                </p>
              </div>
            </div>
          </section>

          {/* Name */}
          <section>
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-1.5">
              {t("settings.name_heading")}
            </h2>
            <span className="sr-only">{displayName}</span>
            <input
              type="text"
              value={displayName}
              maxLength={255}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder={t("settings.name_placeholder")}
              className="w-full rounded-lg border border-separator/60 bg-fill/30 px-3 py-2 text-callout text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-primary/80"
            />
            <div className="mt-1 text-right text-caption text-ink-tertiary">
              {displayName.length}/255
            </div>
          </section>

          {/* Email */}
          <section>
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-1">
              {t("settings.email_heading")}
            </h2>
            <p className="m-0 mb-2.5 text-callout text-ink font-medium">
              {email}
            </p>
            <Button variant="secondary" size="sm" className="rounded-lg">
              {t("settings.change_email")}
            </Button>
          </section>

          {/* Password */}
          <section>
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-1.5">
              {t("settings.password_heading")}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-lg"
              onClick={() => {
                setTab("account");
                setSubView("change_password");
              }}
            >
              {t("settings.change_password")}
            </Button>
          </section>

          {/* Connected accounts */}
          <section className="border-t border-separator/40 pt-4">
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-1">
              {t("settings.connected_accounts_heading")}
            </h2>
            <p className="m-0 text-footnote text-ink-secondary mb-2">
              {t("settings.connected_accounts_desc")}
            </p>
            <p className="m-0 text-footnote text-ink-secondary mb-3">
              {t("settings.connected_login_as", { email })}
            </p>
            <p className="m-0 text-caption text-ink-tertiary mb-3">
              {t("settings.connected_password_notice")}
            </p>
            <div className="flex flex-col gap-2 max-w-[320px]">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-lg w-full justify-center"
              >
                {t("settings.connect_facebook")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-lg w-full justify-center"
              >
                {t("settings.connect_apple")}
              </Button>
            </div>
          </section>

          {/* Sign out */}
          <section className="border-t border-separator/40 pt-5 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                variant="destructive"
                className="h-10 px-6 text-callout font-semibold rounded-xl"
                onClick={onSignOut}
              >
                {t("app.sign_out")}
              </Button>
              {onSignOutEverywhere && (
                <Button
                  variant="secondary"
                  className="h-10 px-4 text-callout font-medium rounded-xl"
                  onClick={onSignOutEverywhere}
                >
                  {t("auth.signout_everywhere")}
                </Button>
              )}
            </div>
          </section>

          {/* Delete account */}
          <section className="border-t border-separator/40 pt-5 pb-2">
            <div className="rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-callout font-bold text-error flex items-center gap-2">
                  <TrashIcon size={16} />
                  {t("settings.delete_account")}
                </div>
                <div className="text-caption text-ink-secondary mt-1">
                  {t("settings.delete_account_desc")}
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-error/50 bg-error/10 hover:bg-error hover:text-white text-error font-semibold text-footnote px-3.5 py-1.5 transition-colors cursor-pointer shrink-0"
                onClick={() => {}}
              >
                {t("settings.delete_account")}
              </button>
            </div>
          </section>
        </div>

        {/* TAB: GENERAL */}
        <div
          className={cx(
            "space-y-6 max-w-[620px]",
            activeTab === "general"
              ? "opacity-100"
              : "opacity-0 pointer-events-none absolute h-0 overflow-hidden",
          )}
        >
          {/* Language */}
          <SelectDropdown
            label={t("settings.language")}
            value={language}
            onChange={setLanguage}
            options={[
              { value: "en", label: "English" },
              {
                value: "vi",
                label: "Tiếng Việt",
                disabled: true,
                badge: t("settings.coming_soon"),
              },
              {
                value: "fr",
                label: "Français",
                disabled: true,
                badge: t("settings.coming_soon"),
              },
              {
                value: "de",
                label: "Deutsch",
                disabled: true,
                badge: t("settings.coming_soon"),
              },
              {
                value: "es",
                label: "Español",
                disabled: true,
                badge: t("settings.coming_soon"),
              },
            ]}
          />

          {/* Home view */}
          <SelectDropdown
            label={t("settings.home_view")}
            value={homeView}
            onChange={(val) => {
              setHomeView(val);
              try {
                localStorage.setItem("agendal.home_view", val);
              } catch {}
            }}
            options={[
              {
                value: "inbox",
                label: t("nav.inbox"),
                icon: <InboxIcon size={16} />,
              },
              {
                value: "upcoming",
                label: t("nav.upcoming"),
                icon: <CalendarIcon size={16} />,
              },
              {
                value: "projects",
                label: t("nav.projects"),
                icon: <SidebarIcon size={16} />,
              },
            ]}
          />

          {/* Date & time section */}
          <div className="pt-2">
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-3.5">
              {t("settings.date_time")}
            </h2>

            <div className="space-y-4">
              {/* Time zone */}
              <SelectDropdown
                label={t("settings.time_zone")}
                value={
                  settings.timezoneAuto !== false
                    ? "auto"
                    : (settings.timezone ?? "UTC")
                }
                onChange={(tz) => {
                  if (tz === "auto") {
                    onChange({ timezoneAuto: true });
                  } else {
                    onChange({ timezone: tz });
                  }
                }}
                options={timeZoneOptions}
              />

              {/* Time format (24h vs 12h) */}
              <SelectDropdown
                label={t("app.time_format")}
                value={settings.timeFormat}
                onChange={(timeFormat) => onChange({ timeFormat })}
                roleMode="radio"
                options={[
                  { value: "24h", label: t("app.time_24h") },
                  { value: "12h", label: t("app.time_12h") },
                ]}
              />

              {/* Date format */}
              <SelectDropdown
                label={t("settings.date_format")}
                value={dateFormat}
                onChange={(fmt) => {
                  setDateFormat(fmt);
                  try {
                    localStorage.setItem("agendal.date_format", fmt);
                  } catch {}
                }}
                options={[
                  { value: "DD-MM-YYYY", label: "DD-MM-YYYY" },
                  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                  { value: "D MMM YYYY", label: "D MMM YYYY" },
                ]}
              />

              {/* Week start */}
              <SelectDropdown
                label={t("app.week_start")}
                value={settings.weekStart}
                onChange={(weekStart) => onChange({ weekStart })}
                helperText={t("settings.week_start_help")}
                roleMode="radio"
                options={[
                  { value: "mon", label: t("app.week_mon") },
                  { value: "sun", label: t("app.week_sun") },
                ]}
              />

              {/* Next week */}
              <SelectDropdown
                label={t("settings.next_week")}
                value={nextWeekDay}
                onChange={(day) => {
                  setNextWeekDay(day);
                  try {
                    localStorage.setItem("agendal.next_week_day", day);
                  } catch {}
                }}
                helperText={t("settings.next_week_help")}
                options={[
                  { value: "mon", label: t("app.week_mon") },
                  { value: "sun", label: t("app.week_sun") },
                  { value: "sat", label: "Saturday" },
                ]}
              />

              {/* Weekend */}
              <SelectDropdown
                label={t("settings.weekend")}
                value={weekendDay}
                onChange={(day) => {
                  setWeekendDay(day);
                  try {
                    localStorage.setItem("agendal.weekend_day", day);
                  } catch {}
                }}
                helperText={t("settings.weekend_help")}
                options={[
                  { value: "sat", label: "Saturday" },
                  { value: "sun", label: t("app.week_sun") },
                ]}
              />

              {/* Karma notice */}
              <p className="m-0 text-caption text-ink-secondary pt-1">
                {t("settings.date_time_karma_notice")}{" "}
                <button
                  type="button"
                  onClick={() => setTab("productivity")}
                  className="text-primary hover:underline font-medium cursor-pointer"
                >
                  {t("settings.tab_productivity")}
                </button>
                .
              </p>

              {/* Page view setting */}
              <div className="pt-2">
                <SelectDropdown
                  label={t("app.page_view")}
                  value={settings.pageView ?? "flat"}
                  onChange={(pageView) =>
                    onChange({ pageView: pageView as PageViewMode })
                  }
                  roleMode="radio"
                  options={[
                    { value: "flat", label: t("app.view_flat") },
                    { value: "full", label: t("app.view_full") },
                  ]}
                />
              </div>

              {/* Smart date recognition */}
              <div className="pt-2">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="block text-callout font-semibold text-ink">
                      {t("settings.smart_date_recognition")}
                    </span>
                    <p className="m-0 text-caption text-ink-tertiary mt-0.5">
                      {t("settings.smart_date_recognition_help")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      label={t("settings.smart_date_recognition")}
                      checked={smartDateRecognition}
                      onChange={setSmartDateRecognition}
                      className="border-b-0 py-0"
                    />
                    <span className="text-footnote font-medium text-ink w-8">
                      {smartDateRecognition
                        ? t("settings.on")
                        : t("settings.off")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Device */}
          <div className="border-t border-separator/40 pt-4 space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-callout font-semibold text-ink">
                {t("app.remember_device")}
              </span>
              <Switch
                label={t("app.remember_device")}
                checked={settings.rememberDevice}
                onChange={(rememberDevice) => onChange({ rememberDevice })}
                className="border-b-0 py-0"
              />
            </div>
            {onInstall && (
              <button
                type="button"
                className="focus-ring cursor-pointer bg-transparent disabled:cursor-default disabled:opacity-40 flex min-h-10 w-full items-center gap-3 py-1.5 text-left text-callout text-ink hover:bg-fill/40 rounded-lg px-2"
                onClick={onInstall}
              >
                <span
                  className="inline-flex text-ink-secondary"
                  aria-hidden="true"
                >
                  <ArrowUpIcon size={18} />
                </span>
                <span className="flex-1">{t("app.install_app")}</span>
                <ChevronRightIcon
                  size={18}
                  className="shrink-0 text-ink-tertiary"
                />
              </button>
            )}
          </div>
        </div>

        {/* TAB: THEME */}
        <div
          className={cx(
            "space-y-6 max-w-[620px]",
            activeTab === "theme"
              ? "opacity-100"
              : "opacity-0 pointer-events-none absolute h-0 overflow-hidden",
          )}
        >
          {/* Description */}
          <p className="m-0 text-footnote text-ink-secondary">
            {t("settings.theme_desc")}{" "}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-primary hover:underline font-medium"
            >
              {t("settings.learn_more")}
            </a>
          </p>

          {/* Sync theme toggle */}
          <div className="flex items-center gap-3">
            <Switch
              label={t("settings.sync_theme")}
              checked={syncTheme}
              onChange={setSyncTheme}
              className="border-b-0 py-0"
            />
            <span className="text-callout font-medium text-ink">
              {t("settings.sync_theme")}
            </span>
          </div>

          {/* Appearance Segmented Pill */}
          <section className="space-y-2.5">
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2.5">
              {t("app.appearance")}
            </h2>
            <Segmented
              label={t("app.appearance")}
              value={settings.theme}
              onChange={(theme, e) => {
                runThemeTransition(e, () => {
                  onChange({ theme });
                });
              }}
              size="lg"
              options={[
                { value: "light", label: t("app.theme_light") },
                { value: "dark", label: t("app.theme_dark") },
                { value: "system", label: t("app.theme_system") },
              ]}
            />
          </section>

          {/* Your themes */}
          <section className="space-y-3">
            <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-3">
              {t("settings.your_themes")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {ALL_THEME_PALETTES.map((item) => {
                const isCurrent = activePalette === item.id;
                const isRippling = ripplingId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      setRipplingId(item.id);
                      setTimeout(() => {
                        setRipplingId((curr) =>
                          curr === item.id ? null : curr,
                        );
                      }, 500);
                      runThemeTransition(e, () => {
                        setActivePalette(item.id);
                        applyThemePalette(item.id);
                      });
                    }}
                    className={cx(
                      "rounded-xl border p-3 bg-surface/40 hover:border-separator transition-all cursor-pointer space-y-2.5",
                      isCurrent
                        ? "border-primary/80 ring-1 ring-primary/40 bg-fill/20"
                        : "border-separator/50 hover:bg-fill/10",
                      isRippling && "animate-pulse-ripple",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-8 rounded-full shadow-xs"
                          style={{
                            backgroundColor:
                              item.id === "default"
                                ? "var(--color-ink)"
                                : item.color,
                          }}
                        />
                        <span className="text-footnote font-semibold text-ink">
                          {item.name}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="text-primary" aria-hidden="true">
                          <CheckIcon size={15} />
                        </span>
                      )}
                    </div>
                    {/* Mockup task rows */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full border"
                          style={{
                            borderColor:
                              item.id === "default"
                                ? "var(--color-ink-secondary)"
                                : item.color,
                          }}
                        />
                        <div className="h-1.5 w-24 rounded-full bg-fill-2" />
                      </div>
                      <div className="pl-5">
                        <div className="h-1.5 w-28 rounded-full bg-fill" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* TAB: SUBSCRIPTION */}
        {activeTab === "subscription" && (
          <div className="space-y-6 max-w-[620px]">
            <div className="rounded-2xl border border-separator/50 bg-fill/20 p-5">
              <span className="text-caption font-semibold uppercase tracking-wider text-primary">
                {t("settings.current_plan_heading")}
              </span>
              <h3 className="mt-1 text-heading font-bold text-ink">
                {t("settings.beginner_plan_title")}
              </h3>
              <p className="mt-1 text-footnote text-ink-secondary">
                {t("settings.beginner_plan_desc")}
              </p>
              <div className="mt-4 flex gap-3">
                <Button variant="primary" size="sm" className="rounded-lg">
                  {t("settings.upgrade_pro")}
                </Button>
                <Button variant="secondary" size="sm" className="rounded-lg">
                  {t("settings.compare_plans")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div
            className="flex flex-col gap-6 max-w-[620px]"
            data-testid="notifications-tab"
          >
            <section
              className="flex flex-col gap-4 rounded-2xl border border-separator/50 bg-surface p-5 shadow-xs"
              aria-label={t("app.notification_diag_title")}
            >
              <div>
                <h3 className="m-0 text-heading font-semibold text-ink">
                  {t("app.notification_diag_title")}
                </h3>
                <p className="m-0 mt-1 text-footnote text-ink-secondary">
                  {t("app.notification_diag_desc")}
                </p>
              </div>

              {/* Browser permission diagnostic */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-separator/40 bg-fill/40 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-callout font-medium text-ink">
                    {t("app.browser_permission")}
                  </span>
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold",
                      !notificationSupported
                        ? "bg-fill text-ink-secondary"
                        : notificationPermission === "granted"
                          ? "bg-success/15 text-success"
                          : notificationPermission === "denied"
                            ? "bg-error/15 text-error"
                            : "bg-warning/15 text-warning",
                    )}
                  >
                    <span
                      className={cx(
                        "size-2 rounded-full",
                        !notificationSupported
                          ? "bg-ink-tertiary"
                          : notificationPermission === "granted"
                            ? "bg-success"
                            : notificationPermission === "denied"
                              ? "bg-error"
                              : "bg-warning",
                      )}
                    />
                    {!notificationSupported
                      ? t("app.perm_unsupported")
                      : notificationPermission === "granted"
                        ? t("app.perm_enabled")
                        : notificationPermission === "denied"
                          ? t("app.perm_blocked")
                          : t("app.perm_not_configured")}
                  </span>
                </div>
                <p className="m-0 text-footnote text-ink-secondary">
                  {!notificationSupported
                    ? t("app.perm_desc_unsupported")
                    : notificationPermission === "granted"
                      ? t("app.perm_desc_enabled")
                      : notificationPermission === "denied"
                        ? t("app.perm_desc_blocked")
                        : t("app.perm_desc_not_configured")}
                </p>
              </div>

              {/* VAPID Server Status */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-separator/40 bg-fill/40 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-callout font-medium text-ink">
                    {t("app.server_push_service")}
                  </span>
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold",
                      vapidConfigured === true
                        ? "bg-success/15 text-success"
                        : vapidConfigured === false
                          ? "bg-error/15 text-error"
                          : "bg-fill text-ink-secondary",
                    )}
                  >
                    <span
                      className={cx(
                        "size-2 rounded-full",
                        vapidConfigured === true
                          ? "bg-success"
                          : vapidConfigured === false
                            ? "bg-error"
                            : "bg-ink-tertiary",
                      )}
                    />
                    {vapidConfigured === true
                      ? t("app.vapid_ready")
                      : vapidConfigured === false
                        ? t("app.vapid_missing")
                        : t("app.vapid_checking")}
                  </span>
                </div>
                <p className="m-0 text-footnote text-ink-secondary">
                  {vapidConfigured === true
                    ? t("app.vapid_desc_ready")
                    : vapidConfigured === false
                      ? t("app.vapid_desc_missing")
                      : t("app.vapid_desc_checking")}
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-2 flex flex-col gap-2.5">
                {notificationPermission !== "granted" ? (
                  <Button
                    variant="primary"
                    disabled={!notificationSupported}
                    onClick={onEnableNotifications}
                  >
                    {t("app.enable_notifications")}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={onSendTestNotification}>
                    <BellIcon size={16} />
                    {t("app.send_test_notification")}
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}

        {/* TAB: REMINDERS */}
        {activeTab === "reminders" && (
          <div className="space-y-6 max-w-[620px]">
            <section>
              <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
                {t("settings.reminders_permission_heading")}
              </h2>
              <div className="flex items-center justify-between rounded-xl border border-separator/40 bg-fill/30 p-4">
                <span className="text-callout text-ink">
                  {t("settings.reminders_system_label")}
                </span>
                <span className="text-footnote font-semibold text-ink-secondary">
                  {remindersStatus ?? "Allowed"}
                </span>
              </div>
            </section>
          </div>
        )}

        {/* TAB: SIDEBAR */}
        {activeTab === "sidebar" && (
          <div className="space-y-6 max-w-[620px]">
            {/* Task counts setting */}
            <section className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="block text-callout font-semibold text-ink">
                    {t("settings.sidebar_show_task_counts")}
                  </span>
                  <p className="m-0 text-caption text-ink-tertiary mt-0.5">
                    {t("settings.sidebar_show_task_counts_desc")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    label={t("settings.sidebar_show_task_counts")}
                    checked={showTaskCounts}
                    onChange={(checked) => {
                      setShowTaskCounts(checked);
                      try {
                        localStorage.setItem(
                          "agendal.sidebar_task_counts",
                          String(checked),
                        );
                        window.dispatchEvent(
                          new Event("agendal:sidebar_counts_changed"),
                        );
                      } catch {}
                    }}
                    className="border-b-0 py-0"
                  />
                  <span className="text-footnote font-medium text-ink w-8">
                    {showTaskCounts ? t("settings.on") : t("settings.off")}
                  </span>
                </div>
              </div>

              {/* Interactive Example Preview Mockup */}
              <div className="rounded-xl border border-separator/50 bg-fill/20 p-4 space-y-2.5">
                <span className="text-caption font-semibold uppercase tracking-wider text-ink-tertiary">
                  {t("settings.sidebar_preview")}
                </span>
                <div className="rounded-lg border border-separator/40 bg-surface/70 p-2.5 max-w-[260px] space-y-1 shadow-xs">
                  {sortableSidebarOrder.map((tabId, idx) => {
                    if (sidebarTabs[tabId] === false) return null;
                    const meta = {
                      inbox: {
                        label: t("nav.inbox"),
                        icon: <InboxIcon size={15} />,
                        count: 5,
                      },
                      upcoming: {
                        label: t("nav.upcoming"),
                        icon: <CalendarIcon size={15} />,
                        count: 12,
                      },
                      notes: {
                        label: t("nav.notes"),
                        icon: <NotesIcon size={15} />,
                        count: 2,
                      },
                      projects: {
                        label: t("nav.projects"),
                        icon: <FolderIcon size={15} />,
                        count: 3,
                      },
                    }[tabId];
                    if (!meta) return null;
                    const isFirstVisible = idx === 0;
                    return (
                      <div
                        key={tabId}
                        className={cx(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-md text-footnote transition-colors",
                          isFirstVisible
                            ? "bg-primary/15! text-primary! font-semibold"
                            : "text-ink-secondary",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {meta.icon}
                          <span>{meta.label}</span>
                        </span>
                        {showTaskCounts && (
                          <span
                            className={cx(
                              "text-caption font-semibold tabular-nums",
                              isFirstVisible
                                ? "text-primary/90"
                                : "text-ink-tertiary",
                            )}
                          >
                            {meta.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-overline uppercase font-semibold text-ink-secondary">
                  {t("settings.sidebar_nav_heading")}
                </h2>
                <button
                  type="button"
                  onClick={resetSidebarNavigation}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-caption font-medium text-ink-secondary hover:text-ink hover:bg-fill/40 transition-colors cursor-pointer"
                  title={t("settings.reset_default")}
                >
                  <RotateCcwIcon size={13} />
                  <span>{t("settings.reset_default")}</span>
                </button>
              </div>
              <p className="text-footnote text-ink-secondary mb-4">
                {t("settings.sidebar_nav_desc")}
              </p>
              <div
                className="flex flex-col rounded-xl border border-separator/40 bg-fill/30 divide-y divide-separator/30 px-3 py-1"
                role="list"
                aria-label={t("settings.sidebar_nav_heading")}
              >
                {sortableSidebarOrder.map((tabId, index) => {
                  const tabMeta = {
                    inbox: {
                      label: t("nav.inbox"),
                      icon: <InboxIcon size={18} />,
                    },
                    upcoming: {
                      label: t("nav.upcoming"),
                      icon: <CalendarIcon size={18} />,
                    },
                    notes: {
                      label: t("nav.notes"),
                      icon: <NotesIcon size={18} />,
                    },
                    projects: {
                      label: t("nav.projects"),
                      icon: <FolderIcon size={18} />,
                    },
                  }[tabId];
                  if (!tabMeta) return null;

                  const isChecked = sidebarTabs[tabId] !== false;
                  const enabledCount =
                    Object.values(sidebarTabs).filter(Boolean).length;
                  const isLastEnabled = isChecked && enabledCount <= 1;
                  const itemProps = getItemProps(tabId);
                  const handleProps = getHandleProps(tabId);

                  return (
                    <div
                      key={tabId}
                      role="listitem"
                      ref={itemProps.ref}
                      style={itemProps.style}
                      data-sortable-id={itemProps["data-sortable-id"]}
                      className={cx(
                        "flex items-center justify-between py-2 px-1 rounded-lg transition-colors select-none",
                        itemProps.className,
                      )}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span
                          {...handleProps}
                          className={cx(
                            "cursor-grab active:cursor-grabbing text-ink-tertiary/60 hover:text-ink transition-colors p-1",
                            handleProps.className,
                          )}
                          title={t("settings.drag_reorder")}
                        >
                          <GripVerticalIcon size={16} />
                        </span>

                        {/* Up / Down Reorder Accessibility Buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveSidebarTab(index, "up")}
                            className="focus-ring rounded p-0.5 text-ink-tertiary hover:text-ink hover:bg-fill disabled:opacity-20 disabled:cursor-default cursor-pointer transition-colors"
                            aria-label={`${t("settings.reorder_up")}: ${tabMeta.label}`}
                          >
                            <ArrowUpIcon size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortableSidebarOrder.length - 1}
                            onClick={() => moveSidebarTab(index, "down")}
                            className="focus-ring rounded p-0.5 text-ink-tertiary hover:text-ink hover:bg-fill disabled:opacity-20 disabled:cursor-default cursor-pointer transition-colors"
                            aria-label={`${t("settings.reorder_down")}: ${tabMeta.label}`}
                          >
                            <ArrowDownIcon size={12} />
                          </button>
                        </div>

                        <span className="text-ink-secondary shrink-0">
                          {tabMeta.icon}
                        </span>
                        <span className="text-callout font-medium text-ink truncate">
                          {tabMeta.label}
                        </span>
                      </div>

                      <label className="flex items-center cursor-pointer p-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLastEnabled}
                          onChange={() => toggleSidebarTab(tabId)}
                          className="checkbox checkbox-primary size-5 rounded-md focus-ring"
                          aria-label={tabMeta.label}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB: QUICK ADD */}
        {activeTab === "quick_add" && (
          <div className="space-y-6 max-w-[620px]">
            <section>
              <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
                {t("settings.quick_add_heading")}
              </h2>
              <div className="rounded-xl border border-separator/40 bg-fill/30 p-4">
                <p className="text-footnote text-ink-secondary mb-0">
                  {t("settings.quick_add_desc")}
                </p>
              </div>
            </section>
          </div>
        )}

        {/* TAB: PRODUCTIVITY */}
        {activeTab === "productivity" && (
          <div className="space-y-6 max-w-[620px]">
            <section>
              <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
                {t("settings.productivity_heading")}
              </h2>
              <div className="rounded-xl border border-separator/40 bg-fill/30 p-4">
                <p className="text-footnote text-ink-secondary mb-0">
                  {t("settings.productivity_desc")}
                </p>
              </div>
            </section>
          </div>
        )}

        {/* TAB: BACKUPS */}
        {activeTab === "backups" && (
          <div className="space-y-6 max-w-[620px]">
            <section>
              <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
                {t("settings.backups_heading")}
              </h2>
              <div className="rounded-xl border border-separator/40 bg-fill/30 p-4 flex items-center justify-between">
                <div>
                  <p className="text-callout font-medium text-ink mb-1">
                    {t("settings.export_data_title")}
                  </p>
                  <p className="text-caption text-ink-secondary m-0">
                    {t("settings.export_data_desc")}
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="rounded-lg">
                  {t("settings.export_json")}
                </Button>
              </div>
            </section>
          </div>
        )}

        {/* TAB: INTEGRATIONS */}
        {activeTab === "integrations" && (
          <div className="space-y-6 max-w-[620px]">
            <section>
              <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
                {t("settings.integrations_heading")}
              </h2>
              <div className="rounded-xl border border-separator/40 bg-fill/30 p-4">
                <p className="text-footnote text-ink-secondary m-0">
                  {t("settings.integrations_desc")}
                </p>
              </div>
            </section>
          </div>
        )}

        {/* TAB: CALENDARS */}
        {activeTab === "calendars" && (
          <div className="space-y-6 max-w-[620px]">
            <section>
              <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
                {t("settings.calendars_heading")}
              </h2>
              <div className="rounded-xl border border-separator/40 bg-fill/30 p-4">
                <p className="text-footnote text-ink-secondary m-0">
                  {t("settings.calendars_desc")}
                </p>
              </div>
            </section>
          </div>
        )}
      </>
    );
  };

  const desktopModal = (
    <>
      <div
        data-testid="settings-backdrop"
        aria-hidden="true"
        onClick={handleClose}
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
        className="fixed inset-0 z-[100] bg-scrim/60 backdrop-blur-[2px] motion-safe:animate-fade-in"
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 pointer-events-none">
        <div
          ref={modalRef}
          data-modal-host="true"
          role="dialog"
          aria-modal="true"
          aria-label={t("settings.title")}
          className="pointer-events-auto relative flex h-[680px] max-h-[min(680px,calc(100dvh-32px))] w-full max-w-[960px] overflow-hidden overscroll-contain rounded-2xl border border-separator/60 bg-surface shadow-2xl motion-safe:animate-scale-in"
        >
          {/* Left Sidebar Navigation */}
          <nav
            className="flex w-[210px] sm:w-[240px] shrink-0 flex-col justify-between border-r border-separator/40 bg-fill/25 p-3.5 select-none"
            aria-label={t("nav.account")}
          >
            <div className="flex flex-col min-h-0 flex-1">
              <h1 className="px-2 pt-1 pb-2.5 text-heading font-bold text-ink">
                {t("settings.title")}
              </h1>

              {/* Search Input */}
              <div className="relative mb-2 px-0.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary">
                  <SearchIcon size={15} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("settings.search_placeholder")}
                  aria-label={t("settings.search_label")}
                  className="w-full rounded-lg border border-separator/50 bg-fill/50 pl-8 pr-2.5 py-1 text-footnote text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-primary/80"
                />
              </div>

              {/* Tabs List */}
              <div
                className="flex flex-1 min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1 py-1"
                role="radiogroup"
                aria-label={t("settings.nav_label")}
              >
                {visibleTabs.map((item, index) => {
                  const checked = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        tabRefs.current[index] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={checked ? 0 : -1}
                      onClick={() => {
                        setTab(item.id);
                        setSubView(null);
                      }}
                      onKeyDown={(e) => onTabKeyDown(e, index)}
                      className={cx(
                        "focus-ring group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-footnote transition-colors",
                        checked
                          ? "bg-primary/15! font-semibold text-primary!"
                          : "text-ink-secondary hover:bg-fill/40 hover:text-ink",
                      )}
                    >
                      <span
                        className={cx(
                          "shrink-0 transition-colors",
                          checked
                            ? "text-primary!"
                            : "text-ink-tertiary group-hover:text-ink",
                        )}
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                {visibleTabs.length === 0 && (
                  <p className="px-2 py-4 text-center text-footnote text-ink-tertiary">
                    {t("settings.none_found")}
                  </p>
                )}
              </div>
            </div>
          </nav>

          {/* Right Main Content Pane */}
          <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-surface">
            {/* Header Bar */}
            <div className="flex h-14 items-center justify-between border-b border-separator/40 px-6 sm:px-8 shrink-0">
              {subView === "change_password" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSubView(null)}
                    aria-label={t("common.back")}
                    className="focus-ring cursor-pointer rounded-lg p-1.5 text-ink-tertiary hover:bg-fill hover:text-ink transition-colors"
                  >
                    <ArrowLeftIcon size={20} />
                  </button>
                  <span className="text-body sm:text-heading font-bold text-ink">
                    {t("settings.change_password")}
                  </span>
                </div>
              ) : (
                <span className="text-body sm:text-heading font-bold text-ink">
                  {currentTabObj?.label ?? t("settings.title")}
                </span>
              )}
              <button
                type="button"
                onClick={handleClose}
                aria-label={t("common.close")}
                className="focus-ring cursor-pointer rounded-lg p-1.5 text-ink-tertiary hover:bg-fill hover:text-ink transition-colors"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 sm:px-8 py-6 space-y-6 text-callout">
              {renderTabContent(tab)}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const preferencesTabIds = new Set([
    "general",
    "theme",
    "sidebar",
    "quick_add",
  ]);
  const tasksTabIds = new Set(["productivity", "reminders", "notifications"]);
  const knownGroupTabIds = new Set([
    "account",
    "general",
    "theme",
    "sidebar",
    "quick_add",
    "productivity",
    "reminders",
    "notifications",
    "backups",
    "integrations",
    "calendars",
  ]);

  const preferencesTabs = allTabs.filter(function isPref(tItem) {
    return preferencesTabIds.has(tItem.id);
  });
  const tasksTabs = allTabs.filter(function isTask(tItem) {
    return tasksTabIds.has(tItem.id);
  });
  const dataTabs = allTabs.filter(function isData(tItem) {
    return (
      tItem.id === "backups" ||
      tItem.id === "integrations" ||
      tItem.id === "calendars" ||
      !knownGroupTabIds.has(tItem.id)
    );
  });

  function renderPhoneSettingsRow(
    item: { id: SettingsTab; label: string; icon: ReactElement },
    index: number,
  ) {
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => openDetail(item.id)}
        className="focus-ring flex min-h-[52px] w-full items-center gap-3 pl-4 pr-3 text-left active:bg-fill hover:bg-fill/60 cursor-pointer"
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-fill text-ink">
          {cloneElement(item.icon as ReactElement<{ size?: number }>, {
            size: 18,
          })}
        </span>
        <span
          className={cx(
            "flex flex-1 min-w-0 items-center gap-3 self-stretch",
            index > 0 && "border-t border-separator",
          )}
        >
          <span className="flex-1 truncate text-body text-ink">
            {item.label}
          </span>
          <ChevronRightIcon size={18} className="text-ink-tertiary shrink-0" />
        </span>
      </button>
    );
  }

  const phoneModal = (
    <div
      ref={modalRef}
      data-modal-host="true"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      className="fixed inset-0 z-[100] flex flex-col bg-paper"
    >
      {phoneView === "list" ? (
        <>
          <div className="flex h-14 items-center justify-end px-2 pt-[max(0.75rem,env(safe-area-inset-top))] shrink-0">
            <button
              type="button"
              onClick={handleClose}
              aria-label={t("common.close")}
              className="focus-ring flex size-11 items-center justify-center cursor-pointer"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-fill text-ink-secondary">
                <XIcon size={18} />
              </span>
            </button>
          </div>
          <div
            key="settings-list"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))]"
          >
            <h1 className="px-1 text-[30px] leading-[36px] font-bold tracking-[-0.02em] text-ink">
              {t("settings.title")}
            </h1>
            <div className="mt-3 flex h-10 items-center gap-2 rounded-field bg-fill px-3">
              <span className="pointer-events-none text-ink-tertiary shrink-0">
                <SearchIcon size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("settings.search_placeholder")}
                aria-label={t("settings.search_label")}
                className="w-full bg-transparent border-0 text-body text-ink placeholder:text-ink-tertiary outline-none focus:outline-none"
              />
            </div>
            {searchQuery.trim().length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-box border border-separator bg-surface">
                {visibleTabs.map(function renderSearchItem(item, index) {
                  return renderPhoneSettingsRow(item, index);
                })}
                {visibleTabs.length === 0 && (
                  <p className="px-4 py-8 text-center text-footnote text-ink-tertiary">
                    {t("settings.none_found")}
                  </p>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openDetail("account")}
                  className="focus-ring mt-5 flex w-full items-center gap-3 rounded-box border border-separator bg-surface px-4 py-3 text-left active:bg-fill hover:bg-fill/60 cursor-pointer"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-fill text-title-3 font-semibold text-ink">
                    {(displayName || name || email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="flex flex-1 min-w-0 flex-col">
                    <span className="text-body font-semibold text-ink truncate">
                      {displayName || name}
                    </span>
                    <span className="text-footnote text-ink-secondary truncate">
                      {email}
                    </span>
                  </span>
                  <ChevronRightIcon
                    size={18}
                    className="text-ink-tertiary shrink-0"
                  />
                </button>
                {[
                  {
                    key: "preferences",
                    label: t("settings.group_preferences"),
                    tabs: preferencesTabs,
                  },
                  {
                    key: "tasks",
                    label: t("settings.group_tasks"),
                    tabs: tasksTabs,
                  },
                  {
                    key: "data",
                    label: t("settings.group_data"),
                    tabs: dataTabs,
                  },
                ].map(function renderPhoneGroup(group) {
                  return (
                    <div key={group.key}>
                      <div className="mt-6 mb-2 px-1 text-overline uppercase font-semibold tracking-[0.03em] text-ink-secondary">
                        {group.label}
                      </div>
                      <div className="overflow-hidden rounded-box border border-separator bg-surface">
                        {group.tabs.map(function renderGroupTab(item, index) {
                          return renderPhoneSettingsRow(item, index);
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="mt-6 overflow-hidden rounded-box border border-separator bg-surface">
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="focus-ring flex min-h-[52px] w-full items-center justify-center text-body font-semibold text-error active:bg-fill hover:bg-fill/60 cursor-pointer"
                  >
                    {t("app.sign_out")}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="relative flex h-14 items-center px-1 bg-paper/90 backdrop-blur border-b border-separator pt-[max(0.75rem,env(safe-area-inset-top))] shrink-0">
            <button
              type="button"
              onClick={backToList}
              aria-label={t("common.back")}
              className="focus-ring inline-flex h-11 items-center gap-1 rounded-field pl-1 pr-3 text-body text-ink cursor-pointer z-10"
            >
              <ChevronLeftIcon size={22} className="shrink-0" />
              <span>
                {subView === "change_password"
                  ? t("settings.tab_account")
                  : t("settings.title")}
              </span>
            </button>
            <h2 className="pointer-events-none absolute inset-x-24 text-center text-body font-semibold text-ink truncate">
              {subView === "change_password"
                ? t("settings.change_password")
                : (currentTabObj?.label ?? t("settings.title"))}
            </h2>
          </div>
          <div
            key={`${activeTabId}-${subView ?? ""}`}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] motion-safe:animate-[slide-in-right_220ms_ease-out]"
          >
            {renderTabContent(activeTabId)}
          </div>
        </>
      )}
    </div>
  );

  if (!mounted) return null;

  const modal = isDesktop ? desktopModal : phoneModal;

  if (portal && typeof document !== "undefined") {
    return createPortal(modal, document.body);
  }

  return modal;
}
