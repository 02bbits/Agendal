import type { CopyKey } from "../../copy";

/** App routes (screens.md). The Next.js app maps these paths to pages. */
export const ROUTES = {
  inbox: "/",
  upcoming: "/upcoming",
  projects: "/projects",
  notes: "/notes",
  search: "/search",
  account: "/account",
  signIn: "/sign-in",
  createAccount: "/create-account",
  project: (id: string) => `/projects/${encodeURIComponent(id)}`,
  task: (id: string) => `/tasks/${encodeURIComponent(id)}`,
} as const;

export type TabId = "inbox" | "upcoming" | "projects" | "notes";

export const TABS: ReadonlyArray<{ id: TabId; href: string; label: CopyKey }> =
  [
    { id: "inbox", href: ROUTES.inbox, label: "nav.inbox" },
    { id: "upcoming", href: ROUTES.upcoming, label: "nav.upcoming" },
    { id: "projects", href: ROUTES.projects, label: "nav.projects" },
    { id: "notes", href: ROUTES.notes, label: "nav.notes" },
  ];

/** Called with a path; return true when handled client-side (the link's default is then prevented). */
export type Navigate = (href: string) => boolean | void;
