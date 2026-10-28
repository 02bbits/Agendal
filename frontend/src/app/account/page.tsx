"use client";

import { AccountScreen } from "@/ui";
import { useAppFrame } from "../AppFrame";

/** Account: appearance applies at once; name, email and sign out come from AA (IM-11, IM-14). */
export default function AccountPage() {
  const { back, settings, changeSettings } = useAppFrame();
  return (
    <AccountScreen
      name=""
      email=""
      settings={settings}
      onChange={changeSettings}
      onBack={back}
      onSignOut={() => {}}
    />
  );
}
