import type { CopyKey } from "../../copy";

/** App routes (screens.md). The Next.js app maps these paths to pages. */
export const ROUTES = {
  inbox: "/",
  upcoming: "/upcoming",
  projects: "/projects",
  noProject: "/projects/none",
  notes: "/notes",
  search: "/search",
  account: "/account",
  signIn: "/sign-in",
  createAccount: "/create-account",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  note: (id: string) => `/notes/${encodeURIComponent(id)}`,
  project: (id: string) => `/projects/${encodeURIComponent(id)}`,
  task: (id: string) => `/tasks/${encodeURIComponent(id)}`,
} as const;

export type TabId = "inbox" | "upcoming" | "projects" | "notes";

export const DEFAULT_SIDEBAR_TABS: Record<TabId, boolean> = {
  inbox: true,
  upcoming: true,
  projects: true,
  notes: true,
};

export const SIDEBAR_TABS_STORAGE_KEY = "agendal.sidebar_tabs_enabled";

export function getStoredSidebarTabs(): Record<TabId, boolean> {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SIDEBAR_TABS };
  try {
    const raw = localStorage.getItem(SIDEBAR_TABS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SIDEBAR_TABS };
    const parsed = JSON.parse(raw);
    return {
      inbox: parsed.inbox !== false,
      upcoming: parsed.upcoming !== false,
      projects: parsed.projects !== false,
      notes: parsed.notes !== false,
    };
  } catch {
    return { ...DEFAULT_SIDEBAR_TABS };
  }
}

export const TABS: ReadonlyArray<{ id: TabId; href: string; label: CopyKey }> =
  [
    { id: "inbox", href: ROUTES.inbox, label: "nav.inbox" },
    { id: "upcoming", href: ROUTES.upcoming, label: "nav.upcoming" },
    { id: "projects", href: ROUTES.projects, label: "nav.projects" },
    { id: "notes", href: ROUTES.notes, label: "nav.notes" },
  ];

/** Called with a path; return true when handled client-side (the link's default is then prevented). */
export type Navigate = (href: string) => boolean | void;
