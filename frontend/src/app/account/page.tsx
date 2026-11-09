"use client";

import { api } from "../../lib/api";
import { AccountScreen } from "../../ui";
import { useAppFrame } from "../AppFrame";

/** Account: appearance applies at once. Name and email come from the session check. */
export default function AccountPage() {
  const { back, settings, changeSettings, user, signOut } = useAppFrame();

  const handleUpdateName = async (newName: string) => {
    try {
      await api("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: newName }),
      });
    } catch {}
  };

  return (
    <AccountScreen
      name={user?.display_name ?? ""}
      email={user?.email ?? ""}
      settings={settings}
      onChange={changeSettings}
      onBack={back}
      // The unsynced-changes dialog arrives with the offline queue (IM-51); nothing is queued yet
      onSignOut={() => signOut()}
      onSignOutEverywhere={() => signOut(true)}
      onUpdateName={handleUpdateName}
    />
  );
}
