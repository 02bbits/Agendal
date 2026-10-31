"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AppShell,
  NoteEditor,
  ROUTES,
  t,
  Toast,
  type AccountSettings,
  type Navigate,
  type TabId,
  type ToastData,
} from "@/ui";
import { api, SESSION_EXPIRED } from "@/lib/api";
import { claimDevice, wipeDevice } from "@/lib/device";

/** The signed-in user, as `GET /user` returns it. */
export interface SignedInUser {
  id: number;
  email: string;
  display_name: string | null;
  theme?: AccountSettings["theme"];
  week_start?: AccountSettings["weekStart"];
  time_format?: AccountSettings["timeFormat"];
  remember_device?: boolean;
}

// The settings as `PATCH /me` names them
const SETTING_FIELDS = {
  theme: "theme",
  weekStart: "week_start",
  timeFormat: "time_format",
  rememberDevice: "remember_device",
} as const;

const THEME_KEY = "agendal.theme";
const PAGE_COLOR = {
  light: "#f6f5f1",
  dark: "#121211",
} as const;

// Screens that work signed out. A signed-in user on the first three goes to Inbox; a reset
// link still works on a device that is signed in (AA-E5).
const SIGNED_OUT_PATHS: readonly string[] = [
  ROUTES.signIn,
  ROUTES.createAccount,
  ROUTES.forgotPassword,
];
const PUBLIC_PATHS: readonly string[] = [
  ...SIGNED_OUT_PATHS,
  ROUTES.resetPassword,
];

const TAB_BY_PATH: Record<string, TabId> = {
  [ROUTES.inbox]: "inbox",
  [ROUTES.upcoming]: "upcoming",
  [ROUTES.projects]: "projects",
  [ROUTES.notes]: "notes",
};

// The tab a screen belongs to: /projects/5 → Projects, Account and Search → Inbox
const tabRootOf = (path: string): string =>
  Object.keys(TAB_BY_PATH).find(
    (root) => root !== ROUTES.inbox && path.startsWith(`${root}/`),
  ) ?? ROUTES.inbox;

const DEFAULT_SETTINGS: AccountSettings = {
  theme: "system",
  weekStart: "mon",
  timeFormat: "24h",
  rememberDevice: true,
};

const settingsOf = (me: SignedInUser): AccountSettings => ({
  theme: me.theme ?? DEFAULT_SETTINGS.theme,
  weekStart: me.week_start ?? DEFAULT_SETTINGS.weekStart,
  timeFormat: me.time_format ?? DEFAULT_SETTINGS.timeFormat,
  rememberDevice: me.remember_device ?? DEFAULT_SETTINGS.rememberDevice,
});

const DAISY_THEME = { light: "agendal-light", dark: "agendal-dark" } as const;

interface AppFrameValue {
  navigate: Navigate;
  back: () => void;
  /** Loaded from `GET /me` and saved with `PATCH /me`; every device follows them. */
  settings: AccountSettings;
  changeSettings: (patch: Partial<AccountSettings>) => void;
  /** One app-wide toast; it survives navigation, e.g. the welcome after sign-up (UX-04). */
  showToast: (message: string) => void;
  /** Opens the full-screen note editor (NC-1) from the capture bar or the Notes tab. */
  openNoteEditor: () => void;
  /** Null until the session check answers, or when signed out. */
  user: SignedInUser | null;
  /** AA-5: ends the session (every session with `everywhere`), wipes the device, opens Sign in. */
  signOut: (everywhere?: boolean) => Promise<void>;
}

const AppFrameContext = createContext<AppFrameValue | null>(null);

export function useAppFrame(): AppFrameValue {
  const value = useContext(AppFrameContext);
  if (!value) throw new Error("useAppFrame needs <AppFrame>");
  return value;
}

/**
 * Client frame around every route (IM-07): tab bar and capture bar on the four
 * tab screens, none on pushed screens (Search, Account). Links are real hrefs;
 * plain clicks go through the Next.js router.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [settings, setSettings] = useState<AccountSettings>(DEFAULT_SETTINGS);
  const [user, setUserState] = useState<SignedInUser | null>(null);
  // Read by the session-expired handler, which mustn't wait for a render
  const userRef = useRef<SignedInUser | null>(null);
  const setUser = useCallback((next: SignedInUser | null) => {
    userRef.current = next;
    setUserState(next);
  }, []);
  // Counts changes made on this device, so a session check sent before one can't undo it
  const settingsEdits = useRef(0);

  // Auth gate (AA §1): a signed-out visit opens Sign in and comes back afterwards. Offline,
  // the request fails and nothing moves, so the app keeps working from the device.
  useEffect(() => {
    let current = true;
    const signedOutPage = SIGNED_OUT_PATHS.includes(pathname);
    const publicPage = PUBLIC_PATHS.includes(pathname);
    const editsBefore = settingsEdits.current;
    api("/me")
      .then(async (response) => {
        if (!current) return;
        if (response.ok) {
          const me: SignedInUser = await response.json();
          await claimDevice(me.id);
          if (!current) return;
          setUser(me);
          if (settingsEdits.current === editsBefore)
            setSettings(settingsOf(me));
          if (signedOutPage) router.replace(ROUTES.inbox);
        } else if (response.status === 401) {
          setUser(null);
          if (!publicPage)
            router.replace(
              `${ROUTES.signIn}?next=${encodeURIComponent(pathname)}`,
            );
        }
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [pathname, router, setUser]);

  // Back goes to the previous screen, but a deep link has none inside the app: then it goes to
  // that tab's root instead of out of the app (AP §2.4)
  const arrivedByDeepLink = useRef(true);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) arrivedByDeepLink.current = false;
    previousPath.current = pathname;
  }, [pathname]);

  const navigate = useCallback<Navigate>(
    (href) => {
      // Tab switches replace the entry, so Back doesn't walk through every tab visited
      if (href in TAB_BY_PATH && pathname in TAB_BY_PATH) router.replace(href);
      else router.push(href);
      return true;
    },
    [router, pathname],
  );
  const back = useCallback(() => {
    if (arrivedByDeepLink.current) router.replace(tabRootOf(pathname));
    else router.back();
  }, [router, pathname]);
  const [editing, setEditing] = useState(false);
  const openNoteEditor = useCallback(() => setEditing(true), []);
  const closeNoteEditor = useCallback(() => setEditing(false), []);
  const [toast, setToast] = useState<ToastData | null>(null);
  const showToast = useCallback(
    (message: string) =>
      setToast((current) => ({
        id: typeof current?.id === "number" ? current.id + 1 : 1,
        message,
      })),
    [],
  );
  const dismissToast = useCallback(
    (id: ToastData["id"]) =>
      setToast((current) => (current?.id === id ? null : current)),
    [],
  );
  // Applies at once, then saves. A refused save puts the old values back; offline the change
  // stays on this device until the sync arrives (IM-52).
  const settingsRef = useRef(settings);
  const changeSettings = useCallback(
    (patch: Partial<AccountSettings>) => {
      settingsEdits.current += 1;
      const before = settingsRef.current;
      const revert = Object.fromEntries(
        Object.keys(patch).map((key) => [
          key,
          before[key as keyof AccountSettings],
        ]),
      );
      settingsRef.current = { ...before, ...patch };
      setSettings(settingsRef.current);
      const body = Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [
          SETTING_FIELDS[key as keyof AccountSettings],
          value,
        ]),
      );
      api("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((response) => {
          if (response.ok || response.status === 401) return;
          settingsRef.current = { ...settingsRef.current, ...revert };
          setSettings(settingsRef.current);
          showToast(t("error.generic", { request_id: "" }));
        })
        .catch(() => {});
    },
    [showToast],
  );

  const signOut = useCallback(
    async (everywhere = false) => {
      const path = everywhere ? "/auth/logout-everywhere" : "/auth/logout";
      const response = await api(path, { method: "POST" }).catch(() => null);
      // Offline, this device is still wiped at once; the server session ends when it expires (AA §2.4).
      // Other devices can only be signed out from the server, so that waits for a connection.
      if (everywhere) {
        if (!response) return showToast(t("app.offline"));
        if (!response.ok && response.status !== 401) {
          const body = await response.json().catch(() => null);
          return showToast(
            t("error.generic", { request_id: body?.error?.request_id ?? "" }),
          );
        }
      }
      await wipeDevice();
      setUser(null);
      settingsRef.current = DEFAULT_SETTINGS;
      setSettings(DEFAULT_SETTINGS);
      document.documentElement.removeAttribute("data-theme");
      router.replace(ROUTES.signIn);
    },
    [router, showToast, setUser],
  );

  // UX-44, AA-E6: a session that ended elsewhere opens Sign in and comes back to this screen
  // afterwards. Nothing is wiped: the same account signing in again keeps its unsynced changes.
  useEffect(() => {
    const expired = () => {
      // Signed out already: a plain visit is the auth gate's job, without the toast
      if (!userRef.current) return;
      setUser(null);
      showToast(t("auth.session_expired"));
      const here = window.location.pathname + window.location.search;
      router.replace(`${ROUTES.signIn}?next=${encodeURIComponent(here)}`);
    };
    window.addEventListener(SESSION_EXPIRED, expired);
    return () => window.removeEventListener(SESSION_EXPIRED, expired);
  }, [router, showToast, setUser]);

  // Appearance: System leaves data-theme off so daisyUI follows the device setting. The choice is
  // also kept for /theme.js, which applies it before the next first paint (AP-3)
  useEffect(() => {
    settingsRef.current = settings;
    // Until /me answers or the user picks one, these are only defaults and would undo what
    // /theme.js applied
    if (!user && settingsEdits.current === 0) return;
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", DAISY_THEME[settings.theme]);
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", PAGE_COLOR[dark ? "dark" : "light"]);
    try {
      localStorage.setItem(THEME_KEY, settings.theme);
    } catch {
      // Private mode: the theme just flashes on the next load
    }
  }, [settings, user]);

  const value = useMemo(
    () => ({
      navigate,
      back,
      settings,
      changeSettings,
      showToast,
      openNoteEditor,
      user,
      signOut,
    }),
    [
      navigate,
      back,
      settings,
      changeSettings,
      showToast,
      openNoteEditor,
      user,
      signOut,
    ],
  );
  const tab = TAB_BY_PATH[pathname];

  return (
    <AppFrameContext.Provider value={value}>
      <AppShell
        tab={tab}
        navigate={navigate}
        // The + appears with the New task sheet (IM-26)
        capture={{ onWrite: openNoteEditor }}
        sidebar={
          PUBLIC_PATHS.includes(pathname)
            ? undefined
            : { accountName: user?.display_name ?? user?.email ?? "" }
        }
        toast={<Toast toast={toast} onDismiss={dismissToast} />}
      >
        {children}
        {editing && (
          <NoteEditor
            onClose={closeNoteEditor}
            onDraftRestored={() => showToast(t("note.draft_restored"))}
          />
        )}
      </AppShell>
    </AppFrameContext.Provider>
  );
}
