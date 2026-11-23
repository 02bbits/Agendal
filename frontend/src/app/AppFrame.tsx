"use client";
import { afterHistoryEntryCloses } from "@/ui/components/useHistoryEntry";
import { useWideScreen } from "@/ui/components/useMediaQuery";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AppShell,
  InstallBanner,
  OfflineBanner,
  ROUTES,
  ToastStack,
  type Project,
} from "@/ui";
import { useOffline } from "@/lib/online";
import { useInstall } from "./useInstall";
import { useNewTask } from "./useNewTask";
import { useUpdateToast } from "./useUpdateToast";
import { TabLoading } from "./TabLoading";
import { AppFrameContext, type AppFrameValue } from "./frame/AppFrameContext";
import { PushPrompt } from "@/ui/features/tasks/PushPrompt";
import { AppOverlays } from "./frame/AppOverlays";
import { isAuthPath, TAB_BY_PATH } from "./frame/frameRoutes";
import { PendingScreen } from "./frame/PendingScreen";
import { SidebarProjects } from "./frame/SidebarProjects";
import { useAccountSettings } from "./frame/useAccountSettings";
import { useOverlays } from "./frame/useOverlays";
import { usePageFlags } from "./frame/usePageFlags";
import { usePrefetch } from "./frame/usePrefetch";
import { useSession } from "./frame/useSession";
import { useSidebarData } from "./frame/useSidebarData";
import { useSignedInUser } from "./frame/useSignedInUser";
import { splashReady, useSplash } from "./frame/useSplash";
import { useSyncToasts } from "./frame/useSyncToasts";
import { useTabNavigation } from "./frame/useTabNavigation";
import { useScreenFocus } from "./frame/useScreenFocus";
import { useToast } from "./frame/useToast";

export { useAppFrame } from "./frame/AppFrameContext";
export type { SignedInUser } from "./frame/signedInUser";

/** How many sidebar projects are fetched ahead. */
const PREFETCHED_PROJECTS = 30;
const TAB_PATHS = Object.keys(TAB_BY_PATH);

/**
 * Client frame around every route (IM-07): tab bar and capture bar on the four tab screens,
 * none on pushed screens (Search, Account). Links are real hrefs; plain clicks go through the
 * Next.js router. Each job lives in its own hook under ./frame.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const wide = useWideScreen();

  const { toasts, showToast, dismissToast } = useToast();
  const splash = useSplash();
  const { user, userRef, setUser } = useSignedInUser();
  const account = useAccountSettings({ user, userRef, showToast });
  const { settings, changeSettings } = account;
  const { sessionChecked, signOut, adopt } = useSession({
    pathname,
    router,
    user,
    userRef,
    setUser,
    settings: account,
    showToast,
    showSplash: splash.show,
  });
  useSyncToasts(user !== null, showToast);
  useUpdateToast(showToast);
  useScreenFocus(pathname);
  usePageFlags(pathname);

  const { tab, navigate, back, pendingTab, shownTab, shownPath } =
    useTabNavigation(pathname, router, splash.enterApp);
  const overlays = useOverlays(pathname, router);
  const {
    open: newTaskOpen,
    openNewTask,
    sheetProps,
  } = useNewTask({
    pathname,
    showToast,
  });
  const sidebar = useSidebarData(pathname);
  const [creatingProject, setCreatingProject] = useState(false);
  const offline = useOffline();
  const installer = useInstall(showToast);
  const install = installer.kind ? installer.install : undefined;

  const ready = sessionChecked && user !== null;
  usePrefetch(router, TAB_PATHS, ready);
  usePrefetch(
    router,
    sidebar.projects
      .slice(0, PREFETCHED_PROJECTS)
      .map((p) => ROUTES.project(p.id)),
    ready,
  );

  const { openSearch } = overlays.search;
  const openSearchOrPage = useCallback(() => {
    if (!userRef.current) return;
    if (wide) openSearch();
    else navigate(ROUTES.search);
  }, [wide, openSearch, navigate, userRef]);

  const { openNoteEditor, editFollowupNote } = overlays.note;
  const { openSettings, closeSettings } = overlays.settings;
  const value = useMemo<AppFrameValue>(
    () => ({
      navigate,
      back,
      settings,
      changeSettings,
      showToast,
      openNoteEditor,
      editFollowupNote,
      openSearch: openSearchOrPage,
      openSettings,
      closeSettings,
      openNewTask,
      user,
      adoptUser: adopt,
      setUser,
      signOut,
    }),
    [
      navigate,
      back,
      settings,
      changeSettings,
      showToast,
      openNoteEditor,
      editFollowupNote,
      openSearchOrPage,
      openSettings,
      closeSettings,
      openNewTask,
      user,
      adopt,
      setUser,
      signOut,
    ],
  );

  const { addProject } = sidebar;
  const projectCreated = useCallback(
    (created: Project) => {
      addProject(created);
      setCreatingProject(false);
      // After the sheet's Back entry is gone, or its back() undoes the push (stuck skeleton)
      afterHistoryEntryCloses(() => navigate(ROUTES.project(created.id)));
    },
    [addProject, navigate],
  );

  // AP-1: on Inbox, once a user is signed in, until Install or Not now on this device.
  // UX-40: offline shows on the four tab screens only
  const installBanner = user && tab === "inbox" && installer.banner && (
    <InstallBanner
      kind={installer.banner}
      onInstall={installer.install}
      onNotNow={installer.notNow}
    />
  );
  const offlineBanner = tab && offline && <OfflineBanner />;

  return (
    <AppFrameContext.Provider value={value}>
      {/* The full-screen loading screen: opening, reloading, going in and out (#161) */}
      <TabLoading
        show={splash.splash !== null}
        ready={splashReady(splash.splash, {
          sessionChecked,
          signedIn: user !== null,
          onAuthScreen: isAuthPath(pathname),
        })}
        onDone={splash.end}
      >
        <AppShell
          tab={shownTab}
          pending={
            pendingTab ? (
              <PendingScreen pending={pendingTab} wide={wide} />
            ) : undefined
          }
          banner={
            offlineBanner || installBanner ? (
              <>
                {offlineBanner}
                {installBanner}
              </>
            ) : undefined
          }
          navigate={navigate}
          onOpenSearch={openSearchOrPage}
          capture={{ onWrite: openNoteEditor, onAdd: openNewTask }}
          sidebar={
            isAuthPath(pathname)
              ? undefined
              : {
                  accountName: user?.display_name ?? user?.email ?? "",
                  email: user?.email ?? "",
                  theme: settings.theme,
                  onThemeChange: (theme) => changeSettings({ theme }),
                  onSignOut: () => signOut(),
                  onSignOutEverywhere: () => signOut(true),
                  counts: sidebar.tabCounts,
                  projects:
                    sidebar.projects.length > 0 ? (
                      <SidebarProjects
                        projects={sidebar.projects}
                        noProjectCount={sidebar.noProjectCount}
                        currentPath={shownPath}
                        navigate={navigate}
                      />
                    ) : undefined,
                  onNewProject: () => setCreatingProject(true),
                  onSearch: openSearchOrPage,
                  onAccount: openSettings,
                  onInstall: install,
                }
          }
          toast={<ToastStack toasts={toasts} onDismiss={dismissToast} />}
        >
          {children}
          <AppOverlays
            pathname={pathname}
            router={router}
            overlays={overlays}
            offline={offline}
            projects={sidebar.projects}
            newTask={{ open: newTaskOpen, sheetProps }}
            creatingProject={creatingProject}
            onCloseProjectSheet={() => setCreatingProject(false)}
            onProjectCreated={projectCreated}
          />
          {/* Reminders (TK-6): asks for notifications when a reminder is first set */}
          <PushPrompt signedIn={user !== null} />
        </AppShell>
      </TabLoading>
    </AppFrameContext.Provider>
  );
}
