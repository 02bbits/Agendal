import { useSyncExternalStore } from "react";

// AP-1: install as an app. Chromium hands over a `beforeinstallprompt` event to show later;
// iOS and Firefox Android only take manual steps, so they get guidance (AP-E1).

/** How this browser installs: its own prompt, or guidance for the Share menu or the app menu. */
export type InstallKind = "prompt" | "ios" | "firefox";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Set by Not now or an install; the banner never shows again on this device. Sign-out keeps it
export const INSTALL_DONE_KEY = "agendal.install";

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function markDone() {
  try {
    localStorage.setItem(INSTALL_DONE_KEY, "1");
  } catch {
    // Private mode: the banner shows again next time
  }
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    markDone();
  });
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const standalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Null when already installed or this browser can't install (Firefox desktop). */
export function installKind(): InstallKind | null {
  if (standalone()) return null;
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  // iPadOS reports a Mac; touch gives it away
  if (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
    return "ios";
  if (/Android/.test(ua) && /Firefox\//.test(ua)) return "firefox";
  return null;
}

/** True once Not now was chosen or the app was installed on this device. */
export function installDone() {
  try {
    return localStorage.getItem(INSTALL_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Not now: hides the banner for good on this device. */
export const dismissInstall = markDone;

/** Opens the browser's install prompt. Dismissed keeps the banner for next time (AP §3). */
export async function promptInstall() {
  const event = deferred;
  if (!event) return;
  // An event prompts once; Chromium sends a fresh one on a later visit
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") markDone();
  else emit();
}

/** Prerendered pages assume nothing can be installed yet. */
export const useInstallKind = () =>
  useSyncExternalStore(subscribe, installKind, () => null);

export const useInstallDone = () =>
  useSyncExternalStore(subscribe, installDone, () => true);
