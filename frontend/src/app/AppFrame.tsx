"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AppShell,
  ROUTES,
  Toast,
  type AccountSettings,
  type Navigate,
  type TabId,
  type ToastData,
} from "@/ui";
import { api } from "@/lib/api";

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
  const [settings, setSettings] = useState<AccountSettings>({
    theme: "system",
    weekStart: "mon",
    timeFormat: "24h",
    rememberDevice: true,
  });
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

  const navigate = useCallback<Navigate>(
    (href) => {
      router.push(href);
      return true;
    },
    [router],
  );
  const back = useCallback(() => router.back(), [router]);
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

  // Appearance: System leaves data-theme off so daisyUI follows the device setting
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", DAISY_THEME[settings.theme]);
  }, [settings.theme]);

  const value = useMemo(
    () => ({ navigate, back, settings, changeSettings, showToast, user }),
    [navigate, back, settings, changeSettings, showToast, user],
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
          AUTH_PATHS.includes(pathname)
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
