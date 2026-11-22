"use client";

import { SetupScreen } from "@/ui";
import { useAppFrame, type SignedInUser } from "../AppFrame";

/** Setup step after Create account (issue #149). */
export default function WelcomePage() {
  const { navigate, showToast, settings, adoptUser, user } = useAppFrame();

  return (
    <SetupScreen
      // The account arrives after the first paint: start over with its name and settings then
      key={user?.id ?? "loading"}
      initialName={user?.display_name ?? ""}
      initialWeekStart={settings.weekStart}
      initialTimeFormat={settings.timeFormat}
      navigate={navigate}
      showToast={showToast}
      // PATCH /me answers with the whole account, as GET /me would
      onSaved={(account) => void adoptUser(account as SignedInUser)}
    />
  );
}
