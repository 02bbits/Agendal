import type { ReactElement, ReactNode, RefObject } from "react";
import { BackButton } from "../../components/BackButton";
import { cx } from "../../components/cx";
import {
  ChevronRightIcon,
  DownloadIcon,
  SearchIcon,
} from "../../components/icons";
import { t } from "../../copy";
import { ROW_PRESS, SettingsCard, SettingsRow } from "./SettingsRow";
import type { SettingsTabItem } from "./settingsTabs";
import { SignOutButtons } from "./SignOutButtons";
import type { SettingsTab } from "./types";

/** Clear of the notch or punch-hole camera: the safe area plus a gap, never under 0.5rem. */
const BELOW_CAMERA =
  "pt-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.5rem))]";
/**
 * A tab's page keeps one 24px margin all round, the camera gap's: above the "‹ Settings" text
 * (BELOW_CAMERA's 8px plus half of the 52px row around a 20px line), below it (the other half
 * plus 8px), the content's left and right, and above the content.
 */
const PAGE_GUTTER = "px-6";
/** The account has its own card at the top of the list, not a row under Preferences. */
const isPreference = (tab: SettingsTabItem) => tab.id !== "account";

function TabGroup({
  tabs,
  onOpen,
  className,
}: {
  tabs: SettingsTabItem[];
  onOpen: (tab: SettingsTab) => void;
  className?: string;
}) {
  return (
    <SettingsCard className={className}>
      {tabs.map((item, index) => (
        <SettingsRow
          key={item.id}
          Icon={item.Icon}
          label={item.label}
          onClick={() => onOpen(item.id)}
          first={index === 0}
        />
      ))}
    </SettingsCard>
  );
}

/**
 * Settings on a phone: a full-screen list (the account card, Preferences, Install app while the
 * browser can install it, Sign out and Sign out on all devices) with search,
 * and each tab on its own page with "‹ Settings" to go back.
 */
export function SettingsPhone({
  modalRef,
  openTab,
  tabs,
  search,
  onSearch,
  account,
  onOpenTab,
  onBackToList,
  onClose,
  onSignOut,
  onSignOutEverywhere,
  onInstall,
  children,
}: {
  modalRef: RefObject<HTMLDivElement | null>;
  /** The tab whose page is open, or none for the list. */
  openTab?: SettingsTabItem;
  /** The tabs the search leaves. */
  tabs: SettingsTabItem[];
  search: string;
  onSearch: (search: string) => void;
  account: { name: string; email: string };
  onOpenTab: (tab: SettingsTab) => void;
  onBackToList: () => void;
  onClose: () => void;
  onSignOut: () => void;
  onSignOutEverywhere?: () => void;
  /** Only while this browser can install the app (AP-1). */
  onInstall?: () => void;
  children: ReactNode;
}): ReactElement {
  const searching = search.trim().length > 0;
  const preferences = tabs.filter(isPreference);
  const initial = (account.name || account.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div
      ref={modalRef}
      data-modal-host="true"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      className="fixed inset-0 z-[100] flex flex-col bg-paper h-dvh max-h-dvh"
    >
      {openTab ? (
        <>
          <div
            className={cx(
              "bg-paper/90 backdrop-blur border-b border-separator shrink-0 pb-2",
              BELOW_CAMERA,
              PAGE_GUTTER,
            )}
          >
            {/* Back and the title share one 52px row under the camera gap */}
            <div className="relative flex h-13 items-center">
              <BackButton
                label={t("settings.title")}
                ariaLabel={t("common.back")}
                onClick={onBackToList}
                className="z-10 h-11 rounded-field text-callout font-medium text-primary"
              />
              <h2 className="pointer-events-none absolute inset-x-24 m-0 text-center text-body font-semibold text-ink truncate">
                {openTab.label}
              </h2>
            </div>
          </div>
          <div
            key={openTab.id}
            className={cx(
              "relative flex-1 min-h-0 overflow-y-auto overscroll-contain pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] motion-safe:animate-[slide-in-right_220ms_ease-out]",
              PAGE_GUTTER,
            )}
          >
            {children}
          </div>
        </>
      ) : (
        <>
          {/* "‹ Back" on the left, like Task details and the other phone screens */}
          <div
            className={cx(
              "flex h-14 box-content items-center justify-start px-2 shrink-0",
              BELOW_CAMERA,
            )}
          >
            <BackButton
              label={t("common.back")}
              onClick={onClose}
              className="h-11 rounded-field px-2 text-callout font-medium text-primary"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <h1 className="mt-1 px-1 text-[30px] leading-[36px] font-bold tracking-[-0.02em] text-ink">
              {t("settings.title")}
            </h1>
            <div className="mt-3 flex h-10 items-center gap-2 rounded-field bg-fill px-3">
              <span className="pointer-events-none text-ink-tertiary shrink-0">
                <SearchIcon size={16} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t("settings.search_placeholder")}
                aria-label={t("settings.search_label")}
                className="w-full bg-transparent border-0 text-body text-ink placeholder:text-ink-tertiary outline-none focus:outline-none"
              />
            </div>
            {searching ? (
              tabs.length > 0 ? (
                <TabGroup tabs={tabs} onOpen={onOpenTab} className="mt-4" />
              ) : (
                <SettingsCard className="mt-4">
                  <p className="px-4 py-8 text-center text-footnote text-ink-tertiary">
                    {t("settings.none_found")}
                  </p>
                </SettingsCard>
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenTab("account")}
                  className={cx(
                    "focus-ring mt-5 flex w-full items-center gap-3 rounded-box border border-separator bg-surface px-4 py-3 text-left",
                    ROW_PRESS,
                  )}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-fill text-title-3 font-semibold text-ink">
                    {initial}
                  </span>
                  <span className="flex flex-1 min-w-0 flex-col">
                    <span className="text-body font-semibold text-ink truncate">
                      {account.name}
                    </span>
                    <span className="text-footnote text-ink-secondary truncate">
                      {account.email}
                    </span>
                  </span>
                  <ChevronRightIcon
                    size={18}
                    className="text-ink-tertiary shrink-0"
                  />
                </button>
                <div className="mt-6 mb-2 px-1 text-overline uppercase font-semibold tracking-[0.03em] text-ink-secondary">
                  {t("settings.group_preferences")}
                </div>
                <TabGroup tabs={preferences} onOpen={onOpenTab} />
                {onInstall && (
                  <SettingsCard className="mt-6">
                    <SettingsRow
                      Icon={DownloadIcon}
                      label={t("app.install_app")}
                      onClick={onInstall}
                      opensPage={false}
                    />
                  </SettingsCard>
                )}
                <SignOutButtons
                  variant="phone"
                  onSignOut={onSignOut}
                  onSignOutEverywhere={onSignOutEverywhere}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
