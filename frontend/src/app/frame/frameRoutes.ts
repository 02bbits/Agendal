import { ROUTES, type CopyKey, type TabId } from "@/ui";

// Screens that work signed out. A signed-in user on these goes to Inbox; a reset link still
// works on a device that is signed in (AA-E5)
export const SIGNED_OUT_PATHS: readonly string[] = [
  ROUTES.signIn,
  ROUTES.createAccount,
  ROUTES.forgotPassword,
  ROUTES.verify,
];
export const PUBLIC_PATHS: readonly string[] = [
  ...SIGNED_OUT_PATHS,
  ROUTES.resetPassword,
];

/** Sign in, Create account, Verify, Welcome and the like: no sidebar, no tab bar. */
export const isAuthPath = (path: string) =>
  PUBLIC_PATHS.includes(path) ||
  path === ROUTES.welcome ||
  path === ROUTES.verify;

/** A project's own page, opened from the sidebar or the Projects list. */
export const PROJECT_PATH = /^\/projects\/[^/?#]+$/;

export const TAB_BY_PATH: Record<string, TabId> = {
  [ROUTES.inbox]: "inbox",
  [ROUTES.upcoming]: "upcoming",
  [ROUTES.projects]: "projects",
  [ROUTES.notes]: "notes",
};

export const TAB_TITLE: Record<TabId, CopyKey> = {
  inbox: "nav.inbox",
  upcoming: "nav.upcoming",
  projects: "nav.projects",
  notes: "nav.notes",
};

/** The tab a screen belongs to: /projects/5 → Projects, Account and Search → Inbox. */
export const tabRootOf = (path: string): string =>
  Object.keys(TAB_BY_PATH).find(
    (root) =>
      root !== ROUTES.inbox && (path === root || path.startsWith(`${root}/`)),
  ) ?? ROUTES.inbox;

/** The tab screens and a project's page: the screens with a sidebar to fill. */
export const isMainPath = (path: string) =>
  Boolean(TAB_BY_PATH[path] || path.startsWith(ROUTES.projects));

/** Screens that open a task beside the list on a wide screen rather than on its own page. */
export const hasTaskPanel = (path: string) =>
  path === ROUTES.inbox ||
  path === ROUTES.upcoming ||
  path.startsWith(`${ROUTES.projects}/`);
