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
  AccountScreen,
  AppShell,
  Link,
  NewTaskSheet,
  NoteEditor,
  ProjectSheet,
  PushExplainer,
  ROUTES,
  SearchPopup,
  sortProjects,
  t,
  Toast,
  useMediaQuery,
  usePushPrompt,
  applyThemePalette,
  type AccountSettings,
  type Navigate,
  type NoteResult,
  type Project,
  type ProjectWithCounts,
  type TabId,
  type ToastData,
} from "@/ui";
import { cx } from "@/ui/components/cx";
import { api, SESSION_EXPIRED } from "@/lib/api";
import { claimDevice, wipeDevice } from "@/lib/device";
import {
  ensureSubscribed,
  pushPermission,
  removeSubscription,
} from "@/lib/push";
import { createProject, getProject, listProjects } from "@/lib/projectApi";
import { inbox, search, upcoming } from "@/lib/taskApi";
import { appClock } from "./appClock";
import { useNewTask } from "./useNewTask";
import {
  forgetNotes,
  listNotes,
  NOTE_UPDATED,
  notesChanged,
  rememberNote,
  replanNote,
  searchNotes,
  submitNote,
} from "@/lib/noteApi";
import { clearRecent } from "@/ui/domain/recentSearches";

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
  light: "#f2f2f2",
  dark: "#1a1a1a",
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
    (root) =>
      root !== ROUTES.inbox && (path === root || path.startsWith(`${root}/`)),
  ) ?? ROUTES.inbox;

const PAGE_VIEW_KEY = "agendal.page_view";

const DEFAULT_SETTINGS: AccountSettings = {
  theme: "system",
  weekStart: "mon",
  timeFormat: "24h",
  rememberDevice: true,
  pageView: "flat",
};

const settingsOf = (me: SignedInUser): AccountSettings => {
  const localPageView =
    typeof window !== "undefined"
      ? (localStorage.getItem(PAGE_VIEW_KEY) as AccountSettings["pageView"])
      : undefined;
  return {
    theme: me.theme ?? DEFAULT_SETTINGS.theme,
    weekStart: me.week_start ?? DEFAULT_SETTINGS.weekStart,
    timeFormat: me.time_format ?? DEFAULT_SETTINGS.timeFormat,
    rememberDevice: me.remember_device ?? DEFAULT_SETTINGS.rememberDevice,
    pageView:
      localPageView === "full" || localPageView === "flat"
        ? localPageView
        : DEFAULT_SETTINGS.pageView,
  };
};

const DAISY_THEME = { light: "agendal-light", dark: "agendal-dark" } as const;

interface AppFrameValue {
  navigate: Navigate;
  back: () => void;
  /** Loaded from `GET /me` and saved with `PATCH /me`; every device follows them. */
  settings: AccountSettings;
  changeSettings: (patch: Partial<AccountSettings>) => void;
  /** One app-wide toast; it survives navigation, e.g. the welcome after sign-up (UX-04). */
  showToast: (messageOrDraft: string | Omit<ToastData, "id">) => void;
  /** Opens the full-screen note editor (NC-1) from the capture bar or the Notes tab. */
  openNoteEditor: () => void;
  editFollowupNote: (note: NoteResult["note"]) => void;
  /** Opens the search popup or navigates to search. */
  openSearch: () => void;
  /** Opens the settings popup. */
  openSettings: () => void;
  /** Closes the settings popup. */
  closeSettings: () => void;
  /** Opens the new task bottom sheet. */
  openNewTask: {
    (opts?: { dueDate?: string }): void;
    (event: unknown): void;
  };
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
  const notePanelWide = useMediaQuery("(min-width: 1280px)");
  const router = useRouter();
  const [settings, setSettings] = useState<AccountSettings>(DEFAULT_SETTINGS);
  const [user, setUserState] = useState<SignedInUser | null>(null);
  const pushPrompt = usePushPrompt(appClock);

  useEffect(() => {
    const onReminderSet = () => {
      pushPrompt.onReminderSet();
    };
    window.addEventListener("agendal:reminder-set", onReminderSet);
    return () => {
      window.removeEventListener("agendal:reminder-set", onReminderSet);
    };
  }, [pushPrompt]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        PAGE_VIEW_KEY,
      ) as AccountSettings["pageView"];
      if (saved === "flat" || saved === "full") {
        queueMicrotask(() => {
          setSettings((prev) =>
            prev.pageView === saved ? prev : { ...prev, pageView: saved },
          );
        });
        document.documentElement.setAttribute("data-page-view", saved);
      } else {
        document.documentElement.setAttribute("data-page-view", "flat");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (pathname === ROUTES.account) {
      document.documentElement.setAttribute("data-account-page", "true");
    } else {
      document.documentElement.removeAttribute("data-account-page");
    }
  }, [pathname]);
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
          // Sign-out removed this device; permission stays, so it comes back without a prompt
          if (pushPermission() === "granted") {
            ensureSubscribed().catch(() => {});
          }
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
  const [editingNote, setEditingNote] = useState<NoteResult["note"] | null>(
    null,
  );
  const openNoteEditor = useCallback(() => {
    setEditingNote(null);
    setEditing(true);
  }, []);
  const editFollowupNote = useCallback((note: NoteResult["note"]) => {
    setEditingNote(note);
    setEditing(true);
  }, []);
  const closeNoteEditor = useCallback(() => {
    setEditing(false);
    setEditingNote(null);
  }, []);
  const [searching, setSearching] = useState(false);
  const openSearch = useCallback(() => setSearching(true), []);
  const closeSearch = useCallback(() => setSearching(false), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => {
    if (pathname !== ROUTES.account) setSettingsOpen(true);
  }, [pathname]);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const isWideSearch = useMediaQuery("(min-width: 768px)");
  const hasPanel = useMediaQuery("(min-width: 1280px)");
  // Closing the editor takes its history entry off with history.back(), which is only done a
  // moment later. The result goes on top of where the editor was opened once that has happened,
  // so Back from the result returns there and never to the editor (RV-E12). A router.replace
  // over the editor's entry would be undone by that back
  const openResult = useCallback(
    (id: string) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        window.removeEventListener("popstate", go);
        const target = notePanelWide
          ? `/notes?note=${encodeURIComponent(id)}`
          : ROUTES.note(id);
        if (window.location.pathname + window.location.search === target)
          router.replace(target, { scroll: false });
        else router.push(target);
      };
      window.addEventListener("popstate", go);
      // The entry wasn't on top (nothing to take off): no popstate comes
      setTimeout(go, 250);
      setEditing(false);
    },
    [router, notePanelWide],
  );
  const [toast, setToast] = useState<ToastData | null>(null);
  const showToast = useCallback(
    (messageOrDraft: string | Omit<ToastData, "id">) =>
      setToast((current) => {
        const nextId = typeof current?.id === "number" ? current.id + 1 : 1;
        if (typeof messageOrDraft === "string") {
          return { id: nextId, message: messageOrDraft };
        }
        return { ...messageOrDraft, id: nextId };
      }),
    [],
  );
  const dismissToast = useCallback(
    (id: ToastData["id"]) =>
      setToast((current) => (current?.id === id ? null : current)),
    [],
  );
  const { open, openNewTask, sheetProps } = useNewTask({
    pathname,
    showToast,
  });
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
      if (patch.pageView && typeof window !== "undefined") {
        try {
          localStorage.setItem(PAGE_VIEW_KEY, patch.pageView);
          document.documentElement.setAttribute(
            "data-page-view",
            patch.pageView,
          );
        } catch {}
      }
      const body = Object.fromEntries(
        Object.entries(patch)
          .map(([key, value]) => [
            SETTING_FIELDS[key as keyof typeof SETTING_FIELDS],
            value,
          ])
          .filter(([field]) => Boolean(field)),
      );
      if (Object.keys(body).length === 0) return;
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
      await Promise.race([
        removeSubscription(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {});
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
      forgetNotes();
      clearRecent();
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
      const palette = localStorage.getItem("agendal.theme_palette");
      if (palette) applyThemePalette(palette);
    } catch {
      // Private mode: the theme just flashes on the next load
    }
  }, [settings, user]);

  const handleOpenTask = useCallback(
    (id: string) => {
      closeSearch();
      if (hasPanel) {
        if (
          pathname === "/" ||
          pathname === "/upcoming" ||
          pathname.startsWith("/projects/")
        ) {
          router.push(`${pathname}?task=${encodeURIComponent(id)}`, {
            scroll: false,
          });
        } else {
          router.push(`/?task=${encodeURIComponent(id)}`);
        }
      } else {
        navigate(ROUTES.task(id));
      }
    },
    [hasPanel, pathname, router, navigate, closeSearch],
  );

  const handleOpenProject = useCallback(
    (id: string) => {
      closeSearch();
      navigate(ROUTES.project(id));
    },
    [closeSearch, navigate],
  );

  const handleOpenSearch = useCallback(() => {
    if (!userRef.current) return;
    if (isWideSearch) {
      openSearch();
    } else {
      navigate(ROUTES.search);
    }
  }, [isWideSearch, openSearch, navigate]);

  const value = useMemo(
    () => ({
      navigate,
      back,
      settings,
      changeSettings,
      showToast,
      openNoteEditor,
      editFollowupNote,
      openSearch: handleOpenSearch,
      openSettings,
      closeSettings,
      openNewTask,
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
      editFollowupNote,
      handleOpenSearch,
      openSettings,
      closeSettings,
      openNewTask,
      user,
      signOut,
    ],
  );
  const tab = TAB_BY_PATH[pathname];

  const [inboxCount, setInboxCount] = useState<number | undefined>(undefined);
  const [upcomingCount, setUpcomingCount] = useState<number | undefined>(
    undefined,
  );
  const [notesCount, setNotesCount] = useState<number | undefined>(undefined);
  const [projectsList, setProjectsList] = useState<ProjectWithCounts[]>([]);
  const [noProjectCount, setNoProjectCount] = useState<number | undefined>(
    undefined,
  );
  const [creatingProject, setCreatingProject] = useState(false);

  const isMainView = Boolean(
    TAB_BY_PATH[pathname] || pathname.startsWith("/projects"),
  );

  const loadSidebarData = useCallback(() => {
    if (!isMainView || PUBLIC_PATHS.includes(pathname)) return;

    listProjects()
      .then((data) => {
        if (Array.isArray(data)) {
          setProjectsList(data);
        }
      })
      .catch(() => {});

    getProject("none")
      .then((data) => {
        if (data && data.progress) {
          setNoProjectCount(data.progress.total - data.progress.done);
        }
      })
      .catch(() => {});

    inbox()
      .then((data) => {
        if (data) {
          const overdue = data.overdue?.length ?? 0;
          const today = data.today?.length ?? 0;
          setInboxCount(overdue + today);
        }
      })
      .catch(() => {});

    listNotes()
      .then((data) => setNotesCount(data.total))
      .catch(() => {});

    upcoming()
      .then((data) => {
        if (data) {
          const count =
            data.total_count ??
            data.days.reduce((acc, d) => acc + (d.tasks?.length ?? 0), 0);
          setUpcomingCount(count);
        }
      })
      .catch(() => {});
  }, [isMainView, pathname]);

  useEffect(() => {
    loadSidebarData();

    const handleUpdate = () => {
      loadSidebarData();
    };

    window.addEventListener("agendal:task-created", handleUpdate);
    window.addEventListener("agendal:projects-changed", handleUpdate);
    window.addEventListener(NOTE_UPDATED, handleUpdate);
    document.addEventListener("visibilitychange", handleUpdate);

    return () => {
      window.removeEventListener("agendal:task-created", handleUpdate);
      window.removeEventListener("agendal:projects-changed", handleUpdate);
      window.removeEventListener(NOTE_UPDATED, handleUpdate);
      document.removeEventListener("visibilitychange", handleUpdate);
    };
  }, [loadSidebarData]);

  const sidebarCounts = useMemo<Partial<Record<TabId, number>>>(() => {
    const counts: Partial<Record<TabId, number>> = {};
    if (inboxCount !== undefined) {
      counts.inbox = inboxCount;
    }
    if (upcomingCount !== undefined) {
      counts.upcoming = upcomingCount;
    }
    if (projectsList.length > 0) {
      counts.projects = projectsList.length + 1;
    }
    if (notesCount !== undefined) {
      counts.notes = notesCount;
    }
    return counts;
  }, [inboxCount, upcomingCount, projectsList.length, notesCount]);

  const sortedSidebarProjects = useMemo(
    () => sortProjects(projectsList),
    [projectsList],
  );

  const sidebarProjects = useMemo(() => {
    if (projectsList.length === 0) return undefined;

    return (
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {sortedSidebarProjects.map((p) => {
          const isCurrent = pathname === ROUTES.project(p.id);
          return (
            <li key={p.id}>
              <Link
                href={ROUTES.project(p.id)}
                navigate={navigate}
                className={cx(
                  "focus-ring row-hover flex min-h-9 items-center gap-2.5 rounded-field px-3 text-body text-ink-secondary",
                  isCurrent && "bg-primary-tint! text-ink!",
                )}
                aria-current={isCurrent ? "page" : undefined}
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: `var(--color-project-${p.colour})` }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-callout">{p.name}</span>
                {p.open !== undefined && (
                  <span
                    className={cx(
                      "text-footnote tabular-nums",
                      isCurrent ? "text-ink" : "text-ink-tertiary",
                    )}
                  >
                    {p.open}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li key="no-project">
          <Link
            href={ROUTES.noProject}
            navigate={navigate}
            className="focus-ring row-hover flex min-h-9 items-center gap-2.5 rounded-field px-3 text-body text-ink-secondary"
          >
            <span
              className="inline-block size-2 shrink-0 rounded-full bg-neutral-content/60"
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-callout">
              {t("project.none")}
            </span>
            {noProjectCount !== undefined && (
              <span className="text-footnote tabular-nums text-ink-tertiary">
                {noProjectCount}
              </span>
            )}
          </Link>
        </li>
      </ul>
    );
  }, [
    projectsList.length,
    sortedSidebarProjects,
    pathname,
    navigate,
    noProjectCount,
  ]);

  const handleProjectCreated = useCallback(
    (created: Project) => {
      setProjectsList((prev) => [...prev, { ...created, open: 0, done: 0 }]);
      setCreatingProject(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
      }
      navigate(ROUTES.project(created.id));
    },
    [navigate],
  );

  return (
    <AppFrameContext.Provider value={value}>
      <AppShell
        tab={tab}
        navigate={navigate}
        onOpenSearch={handleOpenSearch}
        capture={{ onWrite: openNoteEditor, onAdd: openNewTask }}
        sidebar={
          PUBLIC_PATHS.includes(pathname)
            ? undefined
            : {
                accountName: user?.display_name ?? user?.email ?? "",
                counts: sidebarCounts,
                projects: sidebarProjects,
                onNewProject: () => setCreatingProject(true),
                onSearch: handleOpenSearch,
                onAccount: openSettings,
              }
        }
        toast={<Toast toast={toast} onDismiss={dismissToast} />}
      >
        {children}
        {settingsOpen && pathname !== ROUTES.account && (
          <AccountScreen
            portal={true}
            name={user?.display_name ?? ""}
            email={user?.email ?? ""}
            settings={settings}
            onChange={changeSettings}
            onBack={closeSettings}
            onSignOut={() => {
              closeSettings();
              signOut();
            }}
            onSignOutEverywhere={() => {
              closeSettings();
              signOut(true);
            }}
            onUpdateName={async (newName: string) => {
              try {
                await api("/me", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ display_name: newName }),
                });
                setUser(user ? { ...user, display_name: newName } : null);
              } catch {}
            }}
          />
        )}
        {editing && (
          <NoteEditor
            note={editingNote ?? undefined}
            onClose={closeNoteEditor}
            onDraftRestored={() => showToast(t("note.draft_restored"))}
            onSubmit={
              editingNote
                ? (text, _clientId, confirmConflicts) =>
                    replanNote(editingNote.id, text, confirmConflicts)
                : submitNote
            }
            onSubmitted={(result) => {
              rememberNote(result);
              notesChanged(result.note.id);
              openResult(result.note.id);
            }}
          />
        )}
        {searching && (
          <SearchPopup
            clock={appClock}
            onClose={closeSearch}
            projects={projectsList}
            timeFormat={settings.timeFormat}
            searchTasks={search}
            searchNotes={searchNotes}
            onOpenTask={handleOpenTask}
            onOpenProject={handleOpenProject}
            onOpenNote={() => {
              // TODO: open the note here once the Notes screen is done.
            }}
          />
        )}
        {open && (
          <NewTaskSheet
            {...sheetProps}
            weekStart={settings.weekStart}
            timeFormat={settings.timeFormat}
          />
        )}
        {creatingProject && (
          <ProjectSheet
            open
            projects={projectsList}
            onClose={() => setCreatingProject(false)}
            clock={appClock}
            onCreate={createProject}
            onCreated={handleProjectCreated}
          />
        )}
        <PushExplainer
          dialog={pushPrompt.dialog}
          onAllow={pushPrompt.allow}
          onNotNow={pushPrompt.notNow}
        />
      </AppShell>
    </AppFrameContext.Provider>
  );
}
