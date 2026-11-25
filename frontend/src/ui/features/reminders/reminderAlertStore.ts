import { now } from "@/lib/clock";

/**
 * Active reminder alerts (#186, TK-6): manages unacknowledged reminder alerts that show
 * the `(1) Agendal` title badge, favicon red dot, and return-to-app motion animation.
 */

export interface ReminderAlert {
  id: string;
  title: string;
  body?: string;
  url?: string;
  timestamp: number;
}

const STORAGE_KEY = "agendal.active_reminders";
const EVENT_NAME = "agendal:reminder-change";

let memoryAlerts: ReminderAlert[] = [];
let initialized = false;

function loadStoredAlerts(): ReminderAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: ReminderAlert[]): void {
  memoryAlerts = alerts;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function initIfNeeded(): void {
  if (!initialized && typeof window !== "undefined") {
    memoryAlerts = loadStoredAlerts();
    initialized = true;
  }
}

export function getReminderAlerts(): ReminderAlert[] {
  initIfNeeded();
  return memoryAlerts;
}

export function getReminderAlertCount(): number {
  return getReminderAlerts().length;
}

export function addReminderAlert(
  draft: Omit<ReminderAlert, "id" | "timestamp"> & { id?: string },
): ReminderAlert {
  initIfNeeded();
  const id =
    draft.id ||
    `alert-${now().getTime()}-${Math.random().toString(36).slice(2, 7)}`;
  const alert: ReminderAlert = {
    ...draft,
    id,
    timestamp: now().getTime(),
  };
  // Avoid duplicate alerts for the same id, task, or test notification
  const existing = memoryAlerts.filter(
    (a) =>
      a.id !== id &&
      (id !== "agendal-test" || a.id !== "agendal-test") &&
      (!draft.url || a.url !== draft.url || id === "agendal-test"),
  );
  const next = [alert, ...existing.filter((a) => a.id !== "agendal-test")];
  saveAlerts(next);
  return alert;
}

export function dismissReminderAlert(id: string): void {
  initIfNeeded();
  const next = memoryAlerts.filter((a) => a.id !== id);
  if (next.length !== memoryAlerts.length) {
    saveAlerts(next);
  }
}

export function clearReminderAlerts(): void {
  initIfNeeded();
  saveAlerts([]);
}

export function subscribeReminderAlerts(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

/** Sets up push message listening from Service Worker and custom in-app trigger events. */
export function setupReminderListeners(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleSwMessage = (event: MessageEvent) => {
    if (event.data?.type === "AGENDAL_REMINDER_TRIGGER") {
      const data = event.data.data;
      const isTest = data.tag === "agendal-test";
      addReminderAlert({
        id: data.tag || (isTest ? "agendal-test" : undefined),
        title: isTest ? data.body || "Test reminder" : data.title || "Agendal",
        body: data.body,
        url: data.url,
      });
    }
  };

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail) {
      addReminderAlert({
        id: detail.id,
        title: detail.title || "Agendal",
        body: detail.body,
        url: detail.url,
      });
    }
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleSwMessage);
  }
  window.addEventListener("agendal:reminder", handleCustomEvent);

  return () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    }
    window.removeEventListener("agendal:reminder", handleCustomEvent);
  };
}
