import { useEffect, type RefObject } from "react";
import { applyThemePalette, type AccountSettings } from "@/ui";
import { writeStoredSetting } from "@/ui/features/shell/routes";
import { DEFAULT_SETTINGS, PAGE_VIEW_KEY } from "./signedInUser";

/** Read by /theme.js, which applies the theme before the next first paint (AP-3). */
const THEME_KEY = "agendal.theme";
const DAISY_THEME = { light: "agendal-light", dark: "agendal-dark" } as const;
/** The browser bar's colour for each look. */
const PAGE_COLOR = { light: "#f2f2f2", dark: "#1a1a1a" } as const;

const prefersDark = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

/**
 * The settings on the page itself: the page view and the theme on <html>, the browser bar's
 * colour, and the copies /theme.js reads before the first paint.
 */
export function useSettingsOnPage(
  settings: AccountSettings,
  signedIn: boolean,
  edits: RefObject<number>,
) {
  // Before anything is read, /theme.js has already set the saved page view and the defaults
  // would undo it (sign-out sets "flat" itself)
  useEffect(() => {
    if (settings === DEFAULT_SETTINGS) return;
    const pageView = settings.pageView ?? "flat";
    document.documentElement.setAttribute("data-page-view", pageView);
    writeStoredSetting(PAGE_VIEW_KEY, pageView);
  }, [settings]);

  // System leaves data-theme off so daisyUI follows the device. Until /me answers or the user
  // picks one, these are only defaults and would undo what /theme.js applied
  useEffect(() => {
    if (!signedIn && edits.current === 0) return;
    applyThemePalette(settings.palette ?? "default");
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", DAISY_THEME[settings.theme]);
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" && prefersDark());
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.removeAttribute("media");
      meta.setAttribute("content", PAGE_COLOR[dark ? "dark" : "light"]);
    });
    // Private mode: the theme just flashes on the next load
    writeStoredSetting(THEME_KEY, settings.theme);
  }, [settings, signedIn, edits]);
}
