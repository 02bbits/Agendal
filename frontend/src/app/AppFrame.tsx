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
  ROUTES,
  t,
  Toast,
  type AccountSettings,
  type Navigate,
  type TabId,
  type ToastData,
} from "@/ui";
import { api } from "@/lib/api";
import { wipeDevice } from "@/lib/device";

/** The signed-in user, as `GET /user` returns it. */
export interface SignedInUser {
  id: number;
  email: string;
  display_name: string | null;
}

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

const DAISY_THEME = { light: "agendal-light", dark: "agendal-dark" } as const;

interface AppFrameValue {
  navigate: Navigate;
  back: () => void;
  /** Kept on the device for now; `GET/PATCH /me` (IM-16) persists them. */
  settings: AccountSettings;
  changeSettings: (patch: Partial<AccountSettings>) => void;
  /** One app-wide toast; it survives navigation, e.g. the welcome after sign-up (UX-04). */
  showToast: (message: string) => void;
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
  const [user, setUser] = useState<SignedInUser | null>(null);

  // Auth gate (AA §1): a signed-out visit opens Sign in and comes back afterwards. Offline,
  // the request fails and nothing moves, so the app keeps working from the device.
  useEffect(() => {
    let current = true;
    const signedOutPage = SIGNED_OUT_PATHS.includes(pathname);
    const publicPage = PUBLIC_PATHS.includes(pathname);
    api("/user")
      .then(async (response) => {
        if (!current) return;
        if (response.ok) {
          setUser(await response.json());
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
  }, [pathname, router]);

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
  const changeSettings = useCallback(
    (patch: Partial<AccountSettings>) =>
      setSettings((current) => ({ ...current, ...patch })),
    [],
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
      setSettings(DEFAULT_SETTINGS);
      router.replace(ROUTES.signIn);
    },
    [router, showToast],
  );

  // Appearance: System leaves data-theme off so daisyUI follows the device setting
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", DAISY_THEME[settings.theme]);
  }, [settings.theme]);

  const value = useMemo(
    () => ({
      navigate,
      back,
      settings,
      changeSettings,
      showToast,
      user,
      signOut,
    }),
    [navigate, back, settings, changeSettings, showToast, user, signOut],
  );
  const tab = TAB_BY_PATH[pathname];

  return (
    <AppFrameContext.Provider value={value}>
      <AppShell
        tab={tab}
        navigate={navigate}
        // The note editor (IM-41) opens from Notes for now; the + appears with the New task sheet (IM-26)
        capture={{ onWrite: () => navigate(ROUTES.notes) }}
        sidebar={
          PUBLIC_PATHS.includes(pathname)
            ? undefined
            : { accountName: user?.display_name ?? user?.email ?? "" }
        }
        toast={<Toast toast={toast} onDismiss={dismissToast} />}
      >
        {children}
      </AppShell>
    </AppFrameContext.Provider>
  );
}
