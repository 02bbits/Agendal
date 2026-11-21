import { useRef, useState } from "react";
import { t } from "../../copy";
import { ChevronDownIcon, ChevronUpIcon } from "../../components/icons";
import type { SettingsTab, ThemeSetting } from "../settings/types";
import { AccountMenu } from "./AccountMenu";
import { SignOutDialog } from "./SignOutDialog";

/**
 * The account row at the foot of the sidebar and the menu it opens above itself. From the
 * keyboard (Enter, Space or an arrow) the menu starts on its first item.
 */
export function SidebarAccount({
  accountName,
  email,
  theme,
  onThemeChange,
  onAccount,
  onSignOut,
  onSignOutEverywhere,
  onInstall,
}: {
  accountName: string;
  email?: string;
  theme?: ThemeSetting;
  onThemeChange?: (theme: ThemeSetting) => void;
  onAccount?: (tab?: SettingsTab) => void;
  onSignOut?: () => void;
  onSignOutEverywhere?: () => void;
  onInstall?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [askingSignOut, setAskingSignOut] = useState(false);
  const [fromKeyboard, setFromKeyboard] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative mt-auto">
      {open && (
        <AccountMenu
          accountName={accountName}
          email={email ?? ""}
          theme={theme ?? "system"}
          onThemeChange={(next) => onThemeChange?.(next)}
          onOpenSettings={(tab) => {
            setOpen(false);
            onAccount?.(tab);
          }}
          onSignOut={() => {
            setOpen(false);
            setAskingSignOut(true);
          }}
          onInstall={onInstall}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
          triggerRef={triggerRef}
          focusFirst={fromKeyboard}
        />
      )}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // detail 0: Enter or Space, so the menu starts on its first item
          setFromKeyboard(e.detail === 0);
          setOpen((was) => !was);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            setFromKeyboard(true);
            setOpen(true);
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
          {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        </span>
      </button>
      <SignOutDialog
        open={askingSignOut}
        onSignOut={() => onSignOut?.()}
        onSignOutEverywhere={onSignOutEverywhere}
        onClose={() => setAskingSignOut(false)}
      />
    </div>
  );
}
