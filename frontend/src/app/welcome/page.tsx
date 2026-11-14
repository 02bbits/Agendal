"use client";

import { SetupScreen } from "@/ui";
import { useAppFrame } from "../AppFrame";

/** Setup step after Create account (issue #149). */
export default function WelcomePage() {
  const { navigate, showToast, settings, changeSettings, user } = useAppFrame();

  return (
    <SetupScreen
      // The account arrives after the first paint: start over with its name and settings then
      key={user?.id ?? "loading"}
      initialName={user?.display_name ?? ""}
      initialWeekStart={settings.weekStart}
      initialTimeFormat={settings.timeFormat}
      navigate={navigate}
      showToast={showToast}
      changeSettings={changeSettings}
    />
  );
}
