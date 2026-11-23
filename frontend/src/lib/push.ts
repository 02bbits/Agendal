import { api } from "./api";
import { now } from "./clock";
import { installKind } from "./install";

// TK-6 reminders (#186, TK §2.5): this device's Web Push subscription. Permission is asked in
// context, never at sign-in; the server sends to every device of the account.

/**
 * - ask: can subscribe, permission not asked yet
 * - granted / denied: what the browser was told
 * - install: iPhone or iPad in Safari; push needs the installed app (iOS 16.4+)
 * - unsupported: no service worker or Push API (or a development build, which has no worker)
 */
export type PushState =
  "ask" | "granted" | "denied" | "install" | "unsupported";

const SNOOZE_KEY = "agendal.push.snoozed_until";
const SNOOZE_DAYS = 14;

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (!supported) return installKind() === "ios" ? "install" : "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "ask";
}

/** Not now: the explainer stays away for 14 days on this device (TK §2.5). */
export function snoozePush(): void {
  try {
    const until = now().getTime() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, String(until));
  } catch {}
}

export function pushSnoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > now().getTime();
  } catch {
    return false;
  }
}

/** The worker's registration, if this build has one (production builds only). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

/**
 * Subscribes this device and tells the server, with permission already granted. A subscription
 * made with an older server key is replaced. False when reminders aren't set up on the server,
 * or this build has no service worker.
 */
export async function subscribePush(): Promise<boolean> {
  const reg = await registration();
  if (!reg) return false;
  const answer = await api("/push-subscriptions/key");
  if (!answer.ok) return false;
  const { public_key: publicKey } = (await answer.json()) as {
    public_key: string | null;
  };
  if (!publicKey) return false;
  const serverKey = keyBytes(publicKey);

  let subscription = await reg.pushManager.getSubscription();
  if (
    subscription &&
    !sameKey(subscription.options.applicationServerKey, serverKey)
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: serverKey,
  });
  const { endpoint, keys } = subscription.toJSON();
  const saved = await api("/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, keys }),
  });
  return saved.ok;
}

/** Allow in the explainer: the browser's own prompt, then subscribe on yes. */
export async function askForPush(): Promise<NotificationPermission> {
  const answer = await Notification.requestPermission();
  if (answer === "granted") await subscribePush().catch(() => false);
  return answer;
}

/** On load, signed in: a device that already allowed it subscribes again, with no prompt. */
export async function renewPush(): Promise<void> {
  if (pushState() === "granted") await subscribePush().catch(() => false);
}

/** This device's endpoint, sent with sign-out so the server forgets it (TK §2.5). */
export async function pushEndpoint(): Promise<string | null> {
  try {
    const reg = await registration();
    return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}

/** After sign-out: the browser drops the subscription too, so nothing more arrives. */
export async function forgetPush(): Promise<void> {
  try {
    const reg = await registration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {}
}

/** Whether the server has reminder keys (Settings > Reminders says why the switch is off). */
export async function pushReady(): Promise<boolean> {
  try {
    const answer = await api("/push-subscriptions/key");
    if (!answer.ok) return false;
    const { public_key: publicKey } = (await answer.json()) as {
      public_key: string | null;
    };
    return Boolean(publicKey);
  } catch {
    return false;
  }
}

/** True when this browser has a subscription (the switch in Settings > Reminders). */
export async function pushSubscribed(): Promise<boolean> {
  return (await pushEndpoint()) !== null;
}

/** The switch turned off: the server forgets this device, then the browser drops it. */
export async function turnOffPush(): Promise<void> {
  const endpoint = await pushEndpoint();
  if (endpoint)
    await api("/push-subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => null);
  await forgetPush();
}

export type TestPushResult =
  | { sent: number; gone: number; failed: number }
  | { error: "not_configured" | "no_devices" | "too_many" | "failed" };

/** Settings > Reminders: a test notification to this device, sent the way reminders are. */
export async function sendTestPush(): Promise<TestPushResult> {
  const endpoint = await pushEndpoint();
  if (!endpoint) return { error: "no_devices" };
  try {
    const answer = await api("/push-subscriptions/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    if (answer.ok)
      return (await answer.json()) as {
        sent: number;
        gone: number;
        failed: number;
      };
    if (answer.status === 429) return { error: "too_many" };
    if (answer.status === 503) return { error: "not_configured" };
    if (answer.status === 409) return { error: "no_devices" };
    return { error: "failed" };
  } catch {
    return { error: "failed" };
  }
}
