import {
  type ComponentType,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { t } from "../../copy";
import { cx } from "../../components/cx";
import {
  DownloadIcon,
  LogOutIcon,
  SlidersIcon,
  UserIcon,
} from "../../components/icons";
import { Segmented } from "../../components/Segmented";
import { runThemeTransition } from "../../domain/themeTransition";
import type { SettingsTab, ThemeSetting } from "../settings/types";

export interface AccountMenuProps {
  /** The button that opens the menu: a press on it toggles, so it is not an outside press. */
  triggerRef?: RefObject<HTMLElement | null>;
  accountName: string;
  email: string;
  theme: ThemeSetting;
  onThemeChange: (theme: ThemeSetting) => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onSignOut: () => void;
  /** While this browser can install the app (AP-1): a row above Sign out. */
  onInstall?: () => void;
  onClose: () => void;
  /** Opened from the keyboard: start on the first item. From a click: nothing is highlighted. */
  focusFirst?: boolean;
}

interface MenuItem {
  label: string;
  Icon: ComponentType<{ size?: number }>;
  /** Sign out: the label and its icon in the error colour. */
  danger?: boolean;
  onSelect: () => void;
}

const ICON_SIZE = 18;

const ITEM =
  "flex h-10 min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-field border-0 bg-transparent px-2.5 text-left text-callout outline-none transition-colors data-[active=true]:bg-fill";

export function AccountMenu({
  accountName,
  email,
  theme,
  onThemeChange,
  onOpenSettings,
  onSignOut,
  onInstall,
  onClose,
  triggerRef,
  focusFirst = false,
}: AccountMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // One highlight for the mouse and the arrow keys, so two rows never light up at once
  const [active, setActive] = useState(focusFirst ? 0 : -1);

  const itemAt = (index: number) => {
    const items =
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    return items?.[index];
  };

  const activate = (index: number) => {
    setActive(index);
    (index >= 0 ? itemAt(index) : menuRef.current)?.focus({
      preventScroll: true,
    });
  };

  useEffect(() => {
    const first = focusFirst
      ? menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
      : menuRef.current;
    first?.focus({ preventScroll: true });
  }, [focusFirst]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      // The trigger toggles on its own click
      if (triggerRef?.current?.contains(target)) return;
      // While the theme transition runs, presses land on its overlay (the <html> element)
      if (target === document.documentElement) return;
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose, triggerRef]);

  /** Pick an item: the menu closes first. */
  const choose = (action: () => void) => () => {
    onClose();
    action();
  };
  const topItems: MenuItem[] = [
    {
      label: t("nav.account"),
      Icon: UserIcon,
      onSelect: choose(() => onOpenSettings("account")),
    },
    {
      label: t("settings.title"),
      Icon: SlidersIcon,
      onSelect: choose(() => onOpenSettings()),
    },
  ];
  const bottomItems: MenuItem[] = [
    ...(onInstall
      ? [
          {
            label: t("app.install_app"),
            Icon: DownloadIcon,
            onSelect: choose(onInstall),
          },
        ]
      : []),
    {
      label: t("app.sign_out"),
      Icon: LogOutIcon,
      danger: true,
      onSelect: choose(onSignOut),
    },
  ];
  const count = topItems.length + bottomItems.length;

  const renderItem = (item: MenuItem, index: number) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      tabIndex={active === index ? 0 : -1}
      data-active={active === index}
      onMouseMove={() => {
        if (active !== index) activate(index);
      }}
      onClick={item.onSelect}
      className={cx(ITEM, item.danger ? "text-error" : "text-ink")}
    >
      <span
        className={cx(
          "inline-flex shrink-0",
          item.danger ? "text-error" : "text-ink-secondary",
        )}
        aria-hidden="true"
      >
        <item.Icon size={ICON_SIZE} />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
    </button>
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Tab") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activate(active < 0 ? 0 : (active + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activate(active < 0 ? count - 1 : (active - 1 + count) % count);
    } else if (e.key === "Home") {
      e.preventDefault();
      activate(0);
    } else if (e.key === "End") {
      e.preventDefault();
      activate(count - 1);
    }
  };

  const handleThemeChange = (
    newTheme: ThemeSetting,
    event?: MouseEvent<HTMLButtonElement>,
  ) => {
    runThemeTransition(event, () => {
      onThemeChange(newTheme);
    });
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t("nav.account")}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => activate(-1)}
      className="absolute bottom-[calc(100%+6px)] left-0 right-0 rounded-box border border-separator bg-surface-elevated shadow-[0_18px_50px_rgba(0,0,0,0.18)] p-1.5 z-50 flex flex-col gap-0.5 outline-none"
    >
      {/* Header (not focusable) */}
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-footnote font-semibold text-ink"
          aria-hidden="true"
        >
          {accountName.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-callout font-semibold text-ink truncate">
            {accountName}
          </span>
          <span className="text-footnote text-ink-secondary truncate">
            {email}
          </span>
        </div>
      </div>

      <div className="my-1 h-px bg-separator -mx-1.5" role="separator" />

      {topItems.map((item, index) => renderItem(item, index))}

      {/* Theme row: the menu stays open while the theme changes */}
      <div
        className="px-2.5 py-1.5 flex flex-col gap-1.5"
        onMouseEnter={() => activate(-1)}
      >
        <span className="text-footnote font-medium text-ink-secondary">
          {t("settings.tab_theme")}
        </span>
        <Segmented
          size="md"
          label={t("settings.tab_theme")}
          value={theme}
          onChange={(val, e) => handleThemeChange(val as ThemeSetting, e)}
          options={[
            { value: "light", label: t("app.theme_light") },
            { value: "dark", label: t("app.theme_dark") },
            { value: "system", label: t("app.theme_system") },
          ]}
        />
      </div>

      <div className="my-1 h-px bg-separator -mx-1.5" role="separator" />

      {bottomItems.map((item, index) =>
        renderItem(item, topItems.length + index),
      )}
    </div>
  );
}
