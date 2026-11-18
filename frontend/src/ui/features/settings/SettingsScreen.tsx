import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { useBackgroundScrollLock } from "../../components/useBackgroundScrollLock";
import { t } from "../../copy";
import { useMediaQuery } from "../tasks/useMediaQuery";
import { AccountTab } from "./account/AccountTab";
import { ChangePassword } from "./account/ChangePassword";
import { TwoFactorOffDialog } from "./account/TwoFactorOffDialog";
import { useDisplayName, type SaveDisplayName } from "./account/useDisplayName";
import { useTwoFactor } from "./account/useTwoFactor";
import { GeneralTab } from "./general/GeneralTab";
import { SettingsDesktop } from "./SettingsDesktop";
import { SettingsPanel } from "./SettingsSection";
import { SettingsPhone } from "./SettingsPhone";
import { filterSettingsTabs, settingsTabs } from "./settingsTabs";
import { SidebarTab } from "./sidebar/SidebarTab";
import { ThemeTab } from "./theme/ThemeTab";
import type { AccountSettings, ChangeSettings, SettingsTab } from "./types";
import { usePhoneSettingsHistory } from "./usePhoneSettingsHistory";

export interface SettingsScreenProps {
  name: string;
  email: string;
  settings: AccountSettings;
  onChange: ChangeSettings;
  onBack: () => void;
  onSignOut: () => void;
  /** Should; omitted until AA ships it. */
  onSignOutEverywhere?: () => void;
  /** Shown when the app can be installed (AP-1). */
  onInstall?: () => void;
  initialTab?: SettingsTab;
  onUpdateName?: SaveDisplayName;
  /** Render over the page from `document.body` (opened from the app, not its own route). */
  portal?: boolean;
  showToast?: (message: string) => void;
  twoFactorEnabled?: boolean;
  onTwoFactorChange?: (enabled: boolean) => void;
}

const noSubscription = () => () => {};
const inBrowser = () => true;
const onServer = () => false;

/** Settings: a dialog on desktop, full-screen pages on a phone. */
export function SettingsScreen({
  name,
  email,
  settings,
  onChange,
  onBack,
  onSignOut,
  onSignOutEverywhere,
  onInstall,
  initialTab = "general",
  onUpdateName,
  portal = false,
  showToast,
  twoFactorEnabled,
  onTwoFactorChange,
}: SettingsScreenProps): ReactElement | null {
  const mounted = useSyncExternalStore(noSubscription, inBrowser, onServer);
  const isDesktop =
    useMediaQuery("(min-width: 768px)") ||
    (typeof window !== "undefined" && !window.matchMedia);

  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [changingPassword, setChangingPassword] = useState(false);
  const [search, setSearch] = useState("");
  const phone = usePhoneSettingsHistory(onBack);
  const displayName = useDisplayName(name, onUpdateName);
  const twoFactor = useTwoFactor({
    enabled: twoFactorEnabled,
    onChange: onTwoFactorChange,
    showToast,
  });

  const modalRef = useRef<HTMLDivElement>(null);
  useBackgroundScrollLock(modalRef);

  const tabs = settingsTabs(isDesktop);
  const shownTabs = filterSettingsTabs(tabs, search);
  // A phone has no Sidebar page: a phone that was a desktop a moment ago shows the list
  const phoneTab =
    phone.phoneView === "list" || phone.phoneView === "sidebar"
      ? undefined
      : phone.phoneView;
  const activeTab = isDesktop ? tab : (phoneTab ?? tab);
  const activeTabItem = tabs.find((item) => item.id === activeTab);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    setChangingPassword(false);
  };

  const openPhoneTab = (next: SettingsTab) => {
    setTab(next);
    phone.openTab(next);
  };

  // Esc steps back one level: Change password, then a phone's tab page, then Settings
  const { backToList, close } = phone;
  const onPhoneTabPage = !isDesktop && phoneTab !== undefined;
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (changingPassword) setChangingPassword(false);
      else if (onPhoneTabPage) backToList();
      else close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changingPassword, onPhoneTabPage, backToList, close]);

  if (!mounted) return null;

  const content = changingPassword ? (
    <ChangePassword email={email} onBack={() => setChangingPassword(false)} />
  ) : (
    <>
      <SettingsPanel active={activeTab === "account"} isDesktop={isDesktop}>
        <AccountTab
          email={email}
          name={displayName}
          rememberDevice={settings.rememberDevice}
          onChange={onChange}
          onChangePassword={() => {
            setTab("account");
            setChangingPassword(true);
          }}
          twoFactor={twoFactor}
          onSignOut={onSignOut}
          onSignOutEverywhere={onSignOutEverywhere}
        />
      </SettingsPanel>
      <SettingsPanel active={activeTab === "general"} isDesktop={isDesktop}>
        <GeneralTab
          settings={settings}
          onChange={onChange}
          onInstall={onInstall}
        />
      </SettingsPanel>
      <SettingsPanel active={activeTab === "theme"} isDesktop={isDesktop}>
        <ThemeTab settings={settings} onChange={onChange} />
      </SettingsPanel>
      {activeTab === "sidebar" && (
        <div className="space-y-6 max-w-[620px]">
          <SidebarTab />
        </div>
      )}
    </>
  );

  const screen = isDesktop ? (
    <SettingsDesktop
      modalRef={modalRef}
      tabs={shownTabs}
      tab={tab}
      onSelectTab={selectTab}
      search={search}
      onSearch={setSearch}
      title={activeTabItem?.label ?? t("settings.title")}
      subPage={
        changingPassword
          ? {
              title: t("settings.change_password"),
              onBack: () => setChangingPassword(false),
            }
          : undefined
      }
      onClose={close}
    >
      {content}
    </SettingsDesktop>
  ) : (
    <SettingsPhone
      modalRef={modalRef}
      openTab={phoneTab ? activeTabItem : undefined}
      tabs={shownTabs}
      search={search}
      onSearch={setSearch}
      account={{ name: displayName.value || name, email }}
      onOpenTab={openPhoneTab}
      onBackToList={backToList}
      onClose={close}
      onSignOut={onSignOut}
    >
      {content}
    </SettingsPhone>
  );

  return (
    <>
      {portal ? createPortal(screen, document.body) : screen}
      <TwoFactorOffDialog
        dialog={twoFactor.offDialog}
        passwordRef={twoFactor.passwordRef}
      />
    </>
  );
}
