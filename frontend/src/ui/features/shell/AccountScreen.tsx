import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import {
  ArrowUpIcon,
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  CloudIcon,
  CreditCardIcon,
  PaletteIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
  SlidersIcon,
  UserIcon,
  XIcon,
} from "../../components/icons";
import { Segmented } from "../../components/Segmented";
import { Switch } from "../../components/Switch";
import type { TimeFormat, WeekStart } from "../../domain/types";

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
}: AccountScreenProps): ReactElement {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [prevName, setPrevName] = useState(name);
  const [displayName, setDisplayName] = useState(name);
  if (name !== prevName) {
    setPrevName(name);
    setDisplayName(name);
  }
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

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
      keywords: "account name email photo plan password 2fa beginner",
    },
    {
      id: "general",
      label: t("app.tab_general"),
      icon: <SlidersIcon size={17} />,
      keywords: "general time format week start page view device sign out",
    },
    {
      id: "subscription",
      label: t("settings.tab_subscription"),
      icon: <CreditCardIcon size={17} />,
      keywords: "subscription plan billing upgrade pro beginner free",
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

  const currentTabObj = allTabs.find(function isCurrent(tItem) {
    return tItem.id === tab;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBack();
      }}
    >
      <div
        ref={modalRef}
        className="relative flex h-[680px] max-h-[94vh] w-full max-w-[960px] overflow-hidden rounded-2xl border border-separator/60 bg-surface shadow-2xl motion-safe:animate-scale-in"
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
              className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1 py-1"
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
                    onClick={() => setTab(item.id)}
                    onKeyDown={(e) => onTabKeyDown(e, index)}
                    className={cx(
                      "focus-ring group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-footnote transition-colors",
                      checked
                        ? "bg-primary/15 font-semibold text-primary"
                        : "text-ink-secondary hover:bg-fill/40 hover:text-ink",
                    )}
                  >
                    <span
                      className={cx(
                        "shrink-0 transition-colors",
                        checked
                          ? "text-primary"
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

          {/* Bottom Add Team */}
          <div className="border-t border-separator/40 pt-2 px-1">
            <button
              type="button"
              className="flex items-center gap-2 text-footnote text-ink-secondary hover:text-ink transition-colors cursor-pointer w-full py-1"
              onClick={() => {}}
            >
              <PlusIcon size={15} />
              <span>{t("settings.add_team")}</span>
            </button>
          </div>
        </nav>

        {/* Right Main Content Pane */}
        <div className="flex flex-1 flex-col min-w-0 bg-surface">
          {/* Header Bar */}
          <div className="flex h-14 items-center justify-between border-b border-separator/40 px-6 sm:px-8 shrink-0">
            <span className="text-body sm:text-heading font-bold text-ink">
              {currentTabObj?.label ?? t("settings.title")}
            </span>
            <button
              type="button"
              onClick={onBack}
              aria-label={t("common.close")}
              className="focus-ring cursor-pointer rounded-lg p-1.5 text-ink-tertiary hover:bg-fill hover:text-ink transition-colors"
            >
              <XIcon size={20} />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8 py-6 space-y-6 text-callout">
            {/* TAB: ACCOUNT */}
            {tab === "account" && (
              <div className="space-y-6 max-w-[620px]">
                {/* Plan */}
                <section>
                  <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-1">
                    {t("settings.plan_heading")}
                  </h2>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-body font-semibold text-ink">
                      {t("settings.plan_beginner")}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-lg"
                    >
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
                      {displayName
                        ? displayName.slice(0, 1).toUpperCase()
                        : "T"}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-lg"
                        >
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
                  <Button variant="secondary" size="sm" className="rounded-lg">
                    {t("settings.add_password")}
                  </Button>
                </section>

                {/* Two-factor authentication */}
                <section>
                  <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-1.5">
                    {t("settings.two_factor_heading")}
                  </h2>
                  <div className="py-1">
                    <Switch
                      label={t("settings.two_factor_switch")}
                      checked={twoFactorEnabled}
                      onChange={setTwoFactorEnabled}
                      className="border-b-0 py-1"
                    />
                    <p className="m-0 mt-1 text-footnote text-ink-secondary">
                      {twoFactorEnabled
                        ? t("settings.two_factor_enabled")
                        : t("settings.two_factor_disabled")}
                    </p>
                  </div>
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
                <section className="border-t border-separator/40 pt-4 flex flex-col items-start gap-2.5">
                  <Button
                    variant="destructive"
                    className="w-full max-w-[280px] h-10 text-callout font-semibold rounded-xl"
                    onClick={onSignOut}
                  >
                    {t("app.sign_out")}
                  </Button>
                  {onSignOutEverywhere && (
                    <button
                      type="button"
                      className="focus-ring min-h-10 cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-footnote font-semibold text-primary hover:bg-fill"
                      onClick={onSignOutEverywhere}
                    >
                      {t("auth.signout_everywhere")}
                    </button>
                  )}
                </section>

                {/* Delete account */}
                <section className="border-t border-separator/40 pt-4 pb-2">
                  <button
                    type="button"
                    className="text-callout font-medium text-error hover:underline cursor-pointer"
                  >
                    {t("settings.delete_account")}
                  </button>
                </section>
              </div>
            )}

            {/* TAB: GENERAL */}
            {tab === "general" && (
              <div className="space-y-6 max-w-[620px]">
                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-2.5 text-ink-secondary">
                    {t("settings.tab_account")}
                  </h2>
                  <div className="flex items-center gap-3 py-1">
                    <span
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#00897b] text-white text-base font-bold shadow-xs"
                      aria-hidden="true"
                    >
                      {displayName
                        ? displayName.slice(0, 1).toUpperCase()
                        : "T"}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-callout font-semibold text-ink truncate">
                        {displayName || email}
                      </p>
                      <p className="m-0 text-footnote text-ink-secondary truncate">
                        {email}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-2.5 text-ink-secondary">
                    {t("app.appearance")}
                  </h2>
                  <Segmented
                    label={t("app.appearance")}
                    value={settings.theme}
                    onChange={(theme) => onChange({ theme })}
                    size="lg"
                    options={[
                      { value: "system", label: t("app.theme_system") },
                      { value: "light", label: t("app.theme_light") },
                      { value: "dark", label: t("app.theme_dark") },
                    ]}
                  />
                </section>

                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-2.5 text-ink-secondary">
                    {t("app.page_view")}
                  </h2>
                  <Segmented
                    label={t("app.page_view")}
                    value={settings.pageView ?? "flat"}
                    onChange={(pageView) =>
                      onChange({ pageView: pageView as PageViewMode })
                    }
                    size="lg"
                    options={[
                      { value: "flat", label: t("app.view_flat") },
                      { value: "full", label: t("app.view_full") },
                    ]}
                  />
                </section>

                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-2.5 text-ink-secondary">
                    {t("app.week_start")}
                  </h2>
                  <Segmented
                    label={t("app.week_start")}
                    value={settings.weekStart}
                    onChange={(weekStart) => onChange({ weekStart })}
                    size="lg"
                    options={[
                      { value: "mon", label: t("app.week_mon") },
                      { value: "sun", label: t("app.week_sun") },
                    ]}
                  />
                </section>

                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-2.5 text-ink-secondary">
                    {t("app.time_format")}
                  </h2>
                  <Segmented
                    label={t("app.time_format")}
                    value={settings.timeFormat}
                    onChange={(timeFormat) => onChange({ timeFormat })}
                    size="lg"
                    options={[
                      { value: "24h", label: t("app.time_24h") },
                      { value: "12h", label: t("app.time_12h") },
                    ]}
                  />
                </section>

                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-2.5 text-ink-secondary">
                    {t("app.this_device")}
                  </h2>
                  <div className="flex flex-col rounded-2xl border border-separator/40 bg-fill/30 px-4 py-1 divide-y divide-separator/30">
                    <Switch
                      label={t("app.remember_device")}
                      checked={settings.rememberDevice}
                      onChange={(rememberDevice) =>
                        onChange({ rememberDevice })
                      }
                      className="border-b-0 py-2.5 min-h-12"
                    />
                    {remindersStatus && (
                      <div className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left text-body text-ink">
                        <span
                          className="inline-flex text-ink-secondary"
                          aria-hidden="true"
                        >
                          <BellIcon size={18} />
                        </span>
                        <span className="flex-1">{t("app.reminders")}</span>
                        <span className="text-ink-secondary">
                          {remindersStatus}
                        </span>
                      </div>
                    )}
                    {onInstall && (
                      <button
                        type="button"
                        className="focus-ring cursor-pointer bg-transparent disabled:cursor-default disabled:opacity-40 flex min-h-12 w-full items-center gap-3 py-2.5 text-left text-body text-ink"
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
                </section>

                <div className="pt-4 flex flex-col items-start gap-3">
                  <Button
                    variant="destructive"
                    className="w-full max-w-[280px] h-11 text-callout font-semibold rounded-xl"
                    onClick={onSignOut}
                  >
                    {t("app.sign_out")}
                  </Button>
                  {onSignOutEverywhere && (
                    <button
                      type="button"
                      className="focus-ring min-h-10 cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-footnote font-semibold text-primary hover:bg-fill"
                      onClick={onSignOutEverywhere}
                    >
                      {t("auth.signout_everywhere")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB: THEME */}
            {tab === "theme" && (
              <div className="space-y-6 max-w-[620px]">
                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-2.5 text-ink-secondary">
                    {t("app.appearance")}
                  </h2>
                  <Segmented
                    label={t("app.appearance")}
                    value={settings.theme}
                    onChange={(theme) => onChange({ theme })}
                    size="lg"
                    options={[
                      { value: "system", label: t("app.theme_system") },
                      { value: "light", label: t("app.theme_light") },
                      { value: "dark", label: t("app.theme_dark") },
                    ]}
                  />
                </section>
                <section>
                  <h2 className="text-overline font-semibold uppercase tracking-wider mb-3 text-ink-secondary">
                    {t("settings.palettes_heading")}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { name: "Graphite", bg: "#282828" },
                      { name: "Classic Red", bg: "#db4c3f" },
                      { name: "Tangerine", bg: "#ff7043" },
                      { name: "Dark Night", bg: "#1f1f1f" },
                    ].map((palette) => (
                      <div
                        key={palette.name}
                        className="flex flex-col items-center gap-2 rounded-xl border border-separator/40 bg-fill/30 p-3 hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <div
                          className="size-10 rounded-full shadow-xs"
                          style={{ backgroundColor: palette.bg }}
                        />
                        <span className="text-footnote font-medium text-ink">
                          {palette.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB: SUBSCRIPTION */}
            {tab === "subscription" && (
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
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-lg"
                    >
                      {t("settings.compare_plans")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: NOTIFICATIONS */}
            {tab === "notifications" && (
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
                      <Button
                        variant="secondary"
                        onClick={onSendTestNotification}
                      >
                        <BellIcon size={16} />
                        {t("app.send_test_notification")}
                      </Button>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* TAB: REMINDERS */}
            {tab === "reminders" && (
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
            {tab === "sidebar" && (
              <div className="space-y-6 max-w-[620px]">
                <section>
                  <h2 className="text-overline uppercase font-semibold text-ink-secondary mb-2">
                    {t("settings.sidebar_nav_heading")}
                  </h2>
                  <p className="text-footnote text-ink-secondary mb-4">
                    {t("settings.sidebar_nav_desc")}
                  </p>
                  <div className="flex flex-col rounded-xl border border-separator/40 bg-fill/30 divide-y divide-separator/30 px-4 py-1">
                    {[
                      t("nav.inbox"),
                      t("nav.upcoming"),
                      t("nav.notes"),
                      t("nav.projects"),
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between py-3"
                      >
                        <span className="text-callout font-medium text-ink">
                          {item}
                        </span>
                        <span className="text-caption font-semibold text-success">
                          {t("settings.visible_label")}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB: QUICK ADD */}
            {tab === "quick_add" && (
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
            {tab === "productivity" && (
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
            {tab === "backups" && (
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
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-lg"
                    >
                      {t("settings.export_json")}
                    </Button>
                  </div>
                </section>
              </div>
            )}

            {/* TAB: INTEGRATIONS */}
            {tab === "integrations" && (
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
            {tab === "calendars" && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
