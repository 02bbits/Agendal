"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { AccountScreen, t } from "../../ui";
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
  const { user, signOut, settings, changeSettings, back } = useAppFrame();
  const [supported] = useState(() => pushSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    pushPermission(),
  );
  const [vapidConfigured, setVapidConfigured] = useState(false);

  useEffect(() => {
    checkVapidConfig()
      .then((res) => setVapidConfigured(res.configured))
      .catch(() => {});
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === "granted") {
      await ensureSubscribed();
    }
  };

  const handleSendTestNotification = async () => {
    await sendTestNotification();
  };

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
    <div className="relative min-h-[calc(100vh-120px)]">
      {/* Ambient background layout so direct visits to /account have realistic content to blur */}
      <div
        className="pointer-events-none select-none opacity-40 blur-[1px] space-y-6 pt-3 md:pt-8"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between">
          <p className="m-0 text-overline font-semibold uppercase text-ink-secondary">
            Today
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display font-bold text-ink">
              {t("nav.inbox")}
            </h1>
            <p className="m-0 text-footnote text-ink-secondary">
              3 overdue · 6 today
            </p>
          </div>
          <div className="rounded-lg bg-primary/20 px-4 py-2 text-primary font-semibold text-callout">
            + New task
          </div>
        </div>
        <div className="rounded-xl border border-separator/40 bg-surface/50 p-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full border-2 border-primary/40" />
            <div className="space-y-1 flex-1">
              <div className="h-4 w-48 rounded-sm bg-fill-2" />
              <div className="h-3 w-24 rounded-sm bg-fill" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-callout font-semibold text-ink">Overdue 3</div>
          <div className="rounded-lg border border-separator/30 p-3 bg-fill/20 h-12" />
          <div className="rounded-lg border border-separator/30 p-3 bg-fill/20 h-12" />
          <div className="rounded-lg border border-separator/30 p-3 bg-fill/20 h-12" />
        </div>
      </div>

      <AccountScreen
        name={user?.display_name ?? ""}
        email={user?.email ?? ""}
        settings={settings}
        onChange={changeSettings}
        onBack={back}
        // The unsynced-changes dialog arrives with the offline queue (IM-51); nothing is queued yet
        onSignOut={() => signOut()}
        onSignOutEverywhere={() => signOut(true)}
        notificationSupported={supported}
        notificationPermission={permission}
        vapidConfigured={vapidConfigured}
        onEnableNotifications={handleEnableNotifications}
        onSendTestNotification={handleSendTestNotification}
        onUpdateName={handleUpdateName}
      />
    </div>
  );
}
