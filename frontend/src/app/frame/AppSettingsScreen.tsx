"use client";

import type { SettingsTab } from "@/ui";
import { SettingsScreen } from "@/ui/features/settings/SettingsScreen";
import { api } from "@/lib/api";
import { useInstall } from "../useInstall";
import { useAppFrame } from "./AppFrameContext";

/**
 * Settings wired to the signed-in account: its name, two-step verification, settings, sign out
 * and install. The same on its own route (/account) and as the popup over any screen.
 */
export function AppSettingsScreen({
  initialTab,
  portal = false,
  onBack,
}: {
  initialTab?: SettingsTab;
  portal?: boolean;
  onBack: () => void;
}) {
  const { settings, changeSettings, user, setUser, signOut, showToast } =
    useAppFrame();
  const installer = useInstall(showToast);

  const updateName = async (displayName: string) => {
    try {
      await api("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      setUser(user ? { ...user, display_name: displayName } : null);
    } catch {}
  };

  // The popup closes first; the /account page itself gives way to Sign in
  const leave = (everywhere: boolean) => {
    if (portal) onBack();
    void signOut(everywhere);
  };

  return (
    <SettingsScreen
      portal={portal}
      initialTab={initialTab}
      name={user?.display_name ?? ""}
      email={user?.email ?? ""}
      settings={settings}
      onChange={changeSettings}
      onBack={onBack}
      showToast={showToast}
      twoFactorEnabled={user?.two_factor_enabled}
      onTwoFactorChange={(enabled) =>
        setUser(user ? { ...user, two_factor_enabled: enabled } : null)
      }
      onSignOut={() => leave(false)}
      onSignOutEverywhere={() => leave(true)}
      onInstall={installer.kind ? installer.install : undefined}
      onUpdateName={updateName}
    />
  );
}
