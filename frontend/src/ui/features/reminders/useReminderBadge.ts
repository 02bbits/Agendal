import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  clearReminderAlerts,
  dismissReminderAlert,
  getReminderAlerts,
  setupReminderListeners,
  subscribeReminderAlerts,
  type ReminderAlert,
} from "./reminderAlertStore";

const ICON_NORMAL = "/icons/icon.svg";
const ICON_BADGED = "/icons/icon-badged.svg";
const EMPTY_ALERTS: ReminderAlert[] = [];

function updateFavicon(badged: boolean): void {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  const target = badged ? ICON_BADGED : ICON_NORMAL;
  if (link.getAttribute("href") !== target) {
    link.setAttribute("href", target);
  }
}

function updateAppBadge(count: number): void {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
  try {
    if (count > 0) {
      void navigator.setAppBadge(count).catch(() => {});
    } else if ("clearAppBadge" in navigator) {
      void navigator.clearAppBadge().catch(() => {});
    }
  } catch {}
}

export function useReminderBadge() {
  const alerts = useSyncExternalStore(
    subscribeReminderAlerts,
    getReminderAlerts,
    () => EMPTY_ALERTS,
  );
  const [returnAlert, setReturnAlert] = useState<ReminderAlert | null>(null);
  const prevAlertIdRef = useRef<string | null>(null);

  useEffect(() => {
    updateFavicon(alerts.length > 0);
    updateAppBadge(alerts.length);
  }, [alerts.length]);

  useEffect(() => {
    const teardownListeners = setupReminderListeners();

    const onAlertChange = () => {
      const current = getReminderAlerts();
      if (current.length > 0) {
        const newest = current[0];
        if (newest && newest.id !== prevAlertIdRef.current) {
          prevAlertIdRef.current = newest.id;
          setReturnAlert(newest);
        }
      } else {
        prevAlertIdRef.current = null;
        setReturnAlert(null);
      }
    };

    const unsubscribe = subscribeReminderAlerts(onAlertChange);

    const onReturn = () => {
      if (document.visibilityState === "visible") {
        const current = getReminderAlerts();
        if (current.length > 0) {
          setReturnAlert(current[0] ?? null);
        }
      }
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);

    return () => {
      teardownListeners();
      unsubscribe();
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, []);

  const dismissAlert = useCallback((id: string) => {
    dismissReminderAlert(id);
    const remaining = getReminderAlerts();
    if (remaining.length === 0) {
      setReturnAlert(null);
    } else {
      setReturnAlert(remaining[0] ?? null);
    }
  }, []);

  /** Clicking X on the return banner clears active alerts so the tab badge is also cleared. */
  const dismissReturnBanner = useCallback(() => {
    clearReminderAlerts();
    setReturnAlert(null);
  }, []);

  /** Timer auto-dismiss hides the banner but keeps the unread badge on tab. */
  const autoDismissReturnBanner = useCallback(() => {
    setReturnAlert(null);
  }, []);

  const clearAll = useCallback(() => {
    clearReminderAlerts();
    setReturnAlert(null);
  }, []);

  return {
    alerts,
    count: alerts.length,
    returnAlert,
    dismissAlert,
    dismissReturnBanner,
    autoDismissReturnBanner,
    clearAll,
  };
}
