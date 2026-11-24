import { useCallback, useEffect, useState } from "react";
import {
  askForPush,
  pushReady,
  pushState,
  pushSubscribed,
  sendTestPush,
  subscribePush,
  turnOffPush,
} from "../../../../lib/push";
import type { CopyKey } from "../../../copy";
import { notifyPushState, usePushState } from "../../tasks/usePushState";

/** Settings > Reminders (TK-6, #186): this device's reminders, on or off, and a test push. */
export function useDeviceReminders() {
  const status = usePushState();
  // null while the server is being asked whether reminders are set up
  const [ready, setReady] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<CopyKey | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([pushReady(), pushSubscribed()]).then(([r, s]) => {
      if (!live) return;
      setReady(r);
      setSubscribed(s);
    });
    return () => {
      live = false;
    };
  }, [status]);

  const toggle = useCallback(async (on: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      if (!on) await turnOffPush();
      else if (pushState() === "granted") await subscribePush();
      else await askForPush();
      setSubscribed(await pushSubscribed());
      notifyPushState();
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const result = await sendTestPush();
    setBusy(false);
    if ("error" in result) {
      setMessage(
        result.error === "too_many"
          ? "settings.push_test_wait"
          : result.error === "not_configured"
            ? "app.vapid_desc_missing"
            : result.error === "no_devices"
              ? "settings.push_test_gone"
              : "settings.push_test_failed",
      );
      if (result.error === "no_devices") setSubscribed(false);
      return;
    }
    if (result.sent > 0) {
      setMessage("settings.push_test_sent");
      // The Service Worker receives the Web Push event from backend and broadcasts
      // AGENDAL_REMINDER_TRIGGER with tag "agendal-test". No duplicate alert needed.
    } else if (result.gone > 0) {
      setMessage("settings.push_test_gone");
      setSubscribed(false);
    } else setMessage("settings.push_test_failed");
  }, []);

  return { status, ready, subscribed, busy, message, toggle, test };
}
