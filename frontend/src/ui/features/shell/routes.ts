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
  welcome: "/welcome",
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

export const DEFAULT_SIDEBAR_TABS_ORDER: TabId[] = [
  "inbox",
  "upcoming",
  "projects",
  "notes",
];

export const SIDEBAR_TABS_STORAGE_KEY = "agendal.sidebar_tabs_enabled";
export const SIDEBAR_TABS_ORDER_KEY = "agendal.sidebar_tabs_order";

/** Reads a saved setting; null on the server or when storage is blocked. */
export function readStoredSetting(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getStoredSidebarTabs(): Record<TabId, boolean> {
  return parseSidebarTabs(readStoredSetting(SIDEBAR_TABS_STORAGE_KEY));
}

export function parseSidebarTabs(raw: string | null): Record<TabId, boolean> {
  try {
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

export function getStoredSidebarTabsOrder(): TabId[] {
  return parseSidebarTabsOrder(readStoredSetting(SIDEBAR_TABS_ORDER_KEY));
}

export function parseSidebarTabsOrder(raw: string | null): TabId[] {
  try {
    if (!raw) return [...DEFAULT_SIDEBAR_TABS_ORDER];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SIDEBAR_TABS_ORDER];
    const valid = parsed.filter((id): id is TabId =>
      DEFAULT_SIDEBAR_TABS_ORDER.includes(id),
    );
    for (const defId of DEFAULT_SIDEBAR_TABS_ORDER) {
      if (!valid.includes(defId)) valid.push(defId);
    }
    return valid;
  } catch {
    return [...DEFAULT_SIDEBAR_TABS_ORDER];
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
