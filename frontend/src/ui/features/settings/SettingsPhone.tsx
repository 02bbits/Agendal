import type { ReactElement, ReactNode, RefObject } from "react";
import { cx } from "../../components/cx";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "../../components/icons";
import { t } from "../../copy";
import type { SettingsTabItem } from "./settingsTabs";
import type { SettingsTab } from "./types";

/** Clear of the notch or punch-hole camera: the safe area plus a gap, never under 0.5rem. */
const BELOW_CAMERA =
  "pt-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.5rem))]";
const ROW_PRESS = "active:bg-fill hover:bg-fill/60 cursor-pointer";

/** The account has its own card at the top of the list, not a row under Preferences. */
const isPreference = (tab: SettingsTabItem) => tab.id !== "account";

function TabRow({
  item,
  first,
  onOpen,
}: {
  item: SettingsTabItem;
  first: boolean;
  onOpen: (tab: SettingsTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className={cx(
        "focus-ring flex min-h-[52px] w-full items-center gap-3 pl-4 pr-3 text-left",
        ROW_PRESS,
      )}
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-fill text-ink">
        <item.Icon size={18} />
      </span>
      <span
        className={cx(
          "flex flex-1 min-w-0 items-center gap-3 self-stretch",
          !first && "border-t border-separator",
        )}
      >
        <span className="flex-1 truncate text-body text-ink">{item.label}</span>
        <ChevronRightIcon size={18} className="text-ink-tertiary shrink-0" />
      </span>
    </button>
  );
}

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
    <div
      className={cx(
        "overflow-hidden rounded-box border border-separator bg-surface",
        className,
      )}
    >
      {tabs.map((item, index) => (
        <TabRow key={item.id} item={item} first={index === 0} onOpen={onOpen} />
      ))}
    </div>
  );
}

/**
 * Settings on a phone: a full-screen list (the account card, Preferences, Sign out) with search,
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
              "px-1 bg-paper/90 backdrop-blur border-b border-separator shrink-0",
              BELOW_CAMERA,
            )}
          >
            {/* Back and the title share one 56px row under the camera gap */}
            <div className="relative flex h-14 items-center">
              <button
                type="button"
                onClick={onBackToList}
                aria-label={t("common.back")}
                className="focus-ring inline-flex h-11 items-center gap-1 rounded-field pl-1 pr-3 text-body text-ink cursor-pointer z-10"
              >
                <ChevronLeftIcon size={22} className="shrink-0" />
                <span>{t("settings.title")}</span>
              </button>
              <h2 className="pointer-events-none absolute inset-x-24 m-0 text-center text-body font-semibold text-ink truncate">
                {openTab.label}
              </h2>
            </div>
          </div>
          <div
            key={openTab.id}
            className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] motion-safe:animate-[slide-in-right_220ms_ease-out]"
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
            <button
              type="button"
              onClick={onClose}
              className="focus-ring inline-flex h-11 items-center gap-1 rounded-field px-2 text-callout font-medium text-primary cursor-pointer"
            >
              <ChevronLeftIcon size={18} className="shrink-0" />
              <span>{t("common.back")}</span>
            </button>
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
                <div className="mt-4 overflow-hidden rounded-box border border-separator bg-surface">
                  <p className="px-4 py-8 text-center text-footnote text-ink-tertiary">
                    {t("settings.none_found")}
                  </p>
                </div>
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
                <div className="mt-6 overflow-hidden rounded-box border border-separator bg-surface">
                  <button
                    type="button"
                    onClick={onSignOut}
                    className={cx(
                      "focus-ring flex min-h-[52px] w-full items-center justify-center text-body font-semibold text-error",
                      ROW_PRESS,
                    )}
                  >
                    {t("app.sign_out")}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
