"use client";

import { SetupScreen } from "@/ui";
import { useAppFrame } from "../AppFrame";

/** Setup step after Create account (issue #149). */
export default function WelcomePage() {
  const { navigate, showToast, settings, changeSettings } = useAppFrame();

  return (
    <SetupScreen
      initialWeekStart={settings.weekStart}
      initialTimeFormat={settings.timeFormat}
      navigate={navigate}
      showToast={showToast}
      changeSettings={changeSettings}
    />
  );
}
