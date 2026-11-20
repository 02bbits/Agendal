import {
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { BackButton } from "../../components/BackButton";
import { cx } from "../../components/cx";
import { SearchIcon, XIcon } from "../../components/icons";
import { t } from "../../copy";
import type { SettingsTabItem } from "./settingsTabs";
import { SignOutButtons } from "./SignOutButtons";
import type { SettingsTab } from "./types";

const HEADER_BUTTON =
  "focus-ring cursor-pointer rounded-lg p-1.5 text-ink-tertiary hover:bg-fill hover:text-ink transition-colors";

/** Arrow keys move through the tab menu: +1 for right or down, -1 for left or up. */
function arrowStep(key: string): number {
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  return 0;
}

/**
 * Settings on desktop: a dialog over the app with the tab menu and search on the left and the
 * open tab on the right; Sign out at the foot of the menu.
 */
export function SettingsDesktop({
  modalRef,
  tabs,
  tab,
  onSelectTab,
  search,
  onSearch,
  title,
  subPage,
  onClose,
  onSignOut,
  onSignOutEverywhere,
  children,
}: {
  modalRef: RefObject<HTMLDivElement | null>;
  /** The tabs the search leaves. */
  tabs: SettingsTabItem[];
  tab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  search: string;
  onSearch: (search: string) => void;
  title: string;
  /** A page opened from the tab (Change password), with its way back. */
  subPage?: { title: string; onBack: () => void };
  onClose: () => void;
  onSignOut: () => void;
  onSignOutEverywhere?: () => void;
  children: ReactNode;
}): ReactElement {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = (event: KeyboardEvent, index: number) => {
    const step = arrowStep(event.key);
    if (!step) return;
    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    onSelectTab(tabs[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <div
        data-testid="settings-backdrop"
        aria-hidden="true"
        onClick={onClose}
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
          <nav
            className="flex w-[210px] sm:w-[240px] shrink-0 flex-col justify-between border-r border-separator/40 bg-fill/25 p-3.5 select-none"
            aria-label={t("nav.account")}
          >
            <div className="flex flex-col min-h-0 flex-1">
              <h1 className="px-2 pt-1 pb-2.5 text-heading font-bold text-ink">
                {t("settings.title")}
              </h1>

              <div className="relative mb-2 px-0.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary">
                  <SearchIcon size={15} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={t("settings.search_placeholder")}
                  aria-label={t("settings.search_label")}
                  className="w-full rounded-lg border border-separator/50 bg-fill/50 pl-8 pr-2.5 py-1 text-footnote text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-primary/80"
                />
              </div>

              <div
                className="flex flex-1 min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1 py-1"
                role="radiogroup"
                aria-label={t("settings.nav_label")}
              >
                {tabs.map((item, index) => {
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
                      onClick={() => onSelectTab(item.id)}
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
                        <item.Icon size={17} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                {tabs.length === 0 && (
                  <p className="px-2 py-4 text-center text-footnote text-ink-tertiary">
                    {t("settings.none_found")}
                  </p>
                )}
              </div>
            </div>
            <SignOutButtons
              variant="desktop"
              onSignOut={onSignOut}
              onSignOutEverywhere={onSignOutEverywhere}
            />
          </nav>

          <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-separator/40 px-6 sm:px-8 shrink-0">
              {subPage ? (
                <div className="flex items-center gap-3">
                  <BackButton
                    label={t("common.back")}
                    onClick={subPage.onBack}
                    className="h-9 rounded-lg px-1 text-callout font-medium text-primary"
                  />
                  <span
                    className="h-4 w-px bg-separator/60"
                    aria-hidden="true"
                  />
                  <span className="text-body sm:text-heading font-bold text-ink">
                    {subPage.title}
                  </span>
                </div>
              ) : (
                <span className="text-body sm:text-heading font-bold text-ink">
                  {title}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close")}
                className={HEADER_BUTTON}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 sm:px-8 py-6 space-y-6 text-callout">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
