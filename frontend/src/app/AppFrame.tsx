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
  type AccountSettings,
  type Navigate,
  type TabId,
} from "@/ui";

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

  const navigate = useCallback<Navigate>(
    (href) => {
      router.push(href);
      return true;
    },
    [router],
  );
  const back = useCallback(() => router.back(), [router]);
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
    () => ({ navigate, back, settings, changeSettings }),
    [navigate, back, settings, changeSettings],
  );
  const tab = TAB_BY_PATH[pathname];

  return (
    <AppFrameContext.Provider value={value}>
      <AppShell
        tab={tab}
        navigate={navigate}
        // The note editor (IM-41) opens from Notes for now; the + appears with the New task sheet (IM-26)
        capture={{ onWrite: () => navigate(ROUTES.notes) }}
      >
        {children}
      </AppShell>
    </AppFrameContext.Provider>
  );
}
