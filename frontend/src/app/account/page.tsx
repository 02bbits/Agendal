"use client";

import { useEffect, useState } from "react";
import { AccountScreen } from "@/ui";
import { useAppFrame } from "../AppFrame";
import {
  checkVapidConfig,
  ensureSubscribed,
  pushPermission,
  pushSupported,
  sendTestNotification,
} from "@/lib/push";

/** Account: appearance applies at once. Name and email come from the session check. */
export default function AccountPage() {
  const { back, settings, changeSettings, user, signOut, showToast } =
    useAppFrame();
  const [vapidConfigured, setVapidConfigured] = useState<boolean | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let active = true;
    checkVapidConfig()
      .then((res) => {
        if (!active) return;
        setSupported(pushSupported());
        setPermission(pushPermission());
        setVapidConfigured(res.configured);
      })
      .catch(() => {
        if (!active) return;
        setSupported(pushSupported());
        setPermission(pushPermission());
        setVapidConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleEnableNotifications = async () => {
    if (!supported) return;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === "granted") {
        await ensureSubscribed();
        showToast({ message: "Notifications enabled successfully! 🔔" });
      }
    } catch {
      // ignore
    }
  };

  const handleSendTestNotification = async () => {
    const success = await sendTestNotification();
    if (success) {
      showToast({ message: "Test notification sent! 🔔" });
    } else {
      showToast({ message: "Could not send notification. Check permissions." });
    }
  };

  return (
    <AccountScreen
      name={user?.display_name ?? ""}
      email={user?.email ?? ""}
      settings={settings}
      onChange={changeSettings}
      onBack={back}
      onSignOut={() => signOut()}
      onSignOutEverywhere={() => signOut(true)}
      notificationSupported={supported}
      notificationPermission={permission}
      vapidConfigured={vapidConfigured}
      onEnableNotifications={handleEnableNotifications}
      onSendTestNotification={handleSendTestNotification}
    />
  );
}
