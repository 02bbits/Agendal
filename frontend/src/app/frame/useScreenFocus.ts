import { useEffect, useRef } from "react";

const APP_NAME = "Agendal";

/**
 * A11Y-72: each screen names the browser tab after its heading ("Inbox · Agendal"). A route
 * change moves focus to that heading, unless the new screen focused a field of its own.
 */
export function useScreenFocus(pathname: string) {
  // ponytail: reads the heading once per route; a heading that loads later (a project name) keeps the
  // old title until the next route change. Watch the heading if that matters.
  const firstScreen = useRef(true);
  useEffect(() => {
    const main = document.querySelector("main");
    const heading =
      main?.querySelector<HTMLElement>("h1") ??
      document.querySelector<HTMLElement>("h1");
    const name = heading?.textContent?.trim();
    document.title = name ? `${name} · ${APP_NAME}` : APP_NAME;

    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    const active = document.activeElement;
    if (!heading || (active && active !== main && main?.contains(active)))
      return;
    if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [pathname]);
}
