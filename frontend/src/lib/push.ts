import { api } from "./api";
import { handleResponse } from "./apiError";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pushSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return (
    typeof navigator.serviceWorker !== "undefined" &&
    typeof window.PushManager !== "undefined" &&
    Boolean(window.PushManager) &&
    typeof window.Notification !== "undefined" &&
    Boolean(window.Notification)
  );
}

export function needsInstall(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const isIos =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) {
    return false;
  }

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as { standalone?: boolean }).standalone === true);

  return !isStandalone;
}

export function pushPermission(): NotificationPermission {
  if (
    typeof window === "undefined" ||
    typeof window.Notification === "undefined" ||
    !window.Notification
  ) {
    return "default";
  }
  return window.Notification.permission;
}

export async function ensureSubscribed(): Promise<void> {
  if (!pushSupported()) {
    return;
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const keyRes = await api("/push-subscriptions/key");
  const keyData = await handleResponse<{ key: string | null }>(keyRes);
  if (!keyData.key) {
    return;
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(keyData.key);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return;
  }

  const res = await api("/push-subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    }),
  });
  await handleResponse(res);
}

export async function removeSubscription(): Promise<void> {
  try {
    if (!pushSupported()) {
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return;
    }
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return;
    }

    try {
      const res = await api("/push-subscriptions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });
      await handleResponse(res);
    } catch {
      // server delete error swallowed
    }

    await subscription.unsubscribe();
  } catch {
    // never throws
  }
}
