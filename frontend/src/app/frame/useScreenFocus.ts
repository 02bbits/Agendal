import { useEffect, useRef } from "react";
import {
  getReminderAlertCount,
  subscribeReminderAlerts,
} from "@/ui/features/reminders/reminderAlertStore";

export const APP_NAME = "Agendal";

/** Formats the document title with `(1) Agendal` when reminders exist, else `Agendal`. */
export function formatDocumentTitle(): string {
  const count = getReminderAlertCount();
  if (count > 0) {
    return `(${count}) ${APP_NAME}`;
  }
  return APP_NAME;
}

/**
 * A11Y-72: each screen names the browser tab Agendal (or shows `(1) Agendal`
 * when a reminder is active (#186)). A route change moves focus to that heading,
 * unless the new screen focused a field of its own.
 */
export function useScreenFocus(pathname: string) {
  const firstScreen = useRef(true);

  useEffect(() => {
    const updateTitle = () => {
      document.title = formatDocumentTitle();
    };

    const main = document.querySelector("main");
    const heading =
      main?.querySelector<HTMLElement>("h1") ??
      document.querySelector<HTMLElement>("h1");
    updateTitle();

    const unsubscribe = subscribeReminderAlerts(updateTitle);

    if (firstScreen.current) {
      firstScreen.current = false;
      return unsubscribe;
    }
    const active = document.activeElement;
    if (!heading || (active && active !== main && main?.contains(active)))
      return unsubscribe;
    if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });

    return unsubscribe;
  }, [pathname]);
}
