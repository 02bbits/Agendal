// Set once per app start (a full page load); client navigations keep it
let taken = false;

/**
 * The Home view path to open when the app starts, or null. Only the first time it is asked,
 * only when the app was opened on "/" itself, and only from 768px (phones have no Home view
 * setting). After that every tab is the user's own choice and nothing redirects.
 */
export function takeHomeView(): string | null {
  if (taken || typeof window === "undefined") return null;
  taken = true;
  try {
    const first = performance.getEntriesByType?.("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const landing = new URL(first?.name ?? window.location.href).pathname;
    if (landing !== "/" || window.location.pathname !== "/") return null;
    if (!window.matchMedia?.("(min-width: 768px)").matches) return null;
    const home = localStorage.getItem("agendal.home_view");
    return home === "upcoming"
      ? "/upcoming"
      : home === "projects"
        ? "/projects"
        : null;
  } catch {
    return null;
  }
}

/** Tests only: start a new app session. */
export function resetHomeViewForTests(): void {
  taken = false;
}
