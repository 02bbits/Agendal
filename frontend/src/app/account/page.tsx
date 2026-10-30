"use client";

import { AccountScreen } from "@/ui";
import { useAppFrame } from "../AppFrame";

/** Account: appearance applies at once. Name and email come from the session check; sign out is IM-14. */
export default function AccountPage() {
  const { back, settings, changeSettings, user } = useAppFrame();
  return (
    <AccountScreen
      name={user?.display_name ?? ""}
      email={user?.email ?? ""}
      settings={settings}
      onChange={changeSettings}
      onBack={back}
      onSignOut={() => {}}
    />
  );
}
