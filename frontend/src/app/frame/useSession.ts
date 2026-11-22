import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";
import { clearThemePalette, ROUTES, t } from "@/ui";
import { clearRecent } from "@/ui/domain/recentSearches";
import { api, EMAIL_UNVERIFIED, SESSION_EXPIRED } from "@/lib/api";
import { forgetConflicts } from "@/lib/conflicts";
import { claimDevice, wipeDevice } from "@/lib/device";
import { readMe, saveMe } from "@/lib/localStore";
import { forgetNotes } from "@/lib/noteApi";
import { PUBLIC_PATHS, SIGNED_OUT_PATHS } from "./frameRoutes";
import type { Splash } from "../TabLoading";
import type { SignedInUser } from "./signedInUser";
import type { AccountSettingsState } from "./useAccountSettings";
import type { ShowToast } from "./useToast";

type Router = {
  replace: (href: string) => void;
};

const signInBack = (here: string) =>
  `${ROUTES.signIn}?next=${encodeURIComponent(here)}`;

/**
 * The session (AA §1): checks it when the app opens, on every screen until the server confirmed it,
 * and when the app becomes visible again; sends a signed-out visit to Sign in and back,
 * keeps an unverified account on Verify, and signs out (AA-5). Offline the check fails and
 * nothing moves, so the app keeps working from the device.
 */
export function useSession({
  pathname,
  router,
  userRef,
  setUser,
  user,
  settings,
  showToast,
  showSplash,
}: {
  pathname: string;
  router: Router;
  userRef: RefObject<SignedInUser | null>;
  setUser: (user: SignedInUser | null) => void;
  user: SignedInUser | null;
  settings: Pick<
    AccountSettingsState,
    "loadFromServer" | "editCount" | "reset"
  >;
  showToast: ShowToast;
  /** The full-screen loading screen on the way in or out (#161); null calls it off. */
  showSplash: (splash: Splash | null) => void;
}) {
  // The first check has answered (signed in, signed out or offline): the start screen only
  // waits for this, the tab's own skeleton covers its data (#161)
  const [sessionChecked, setSessionChecked] = useState(false);
  const { loadFromServer, editCount, reset } = settings;

  // Whether the server confirmed this session since the app opened: then a screen change asks
  // nothing (AP §10 request budget). Signed out, offline or not asked yet, every screen asks again
  const confirmed = useRef(false);

  /** Takes an account the server answered with: the device, the user and their settings. */
  const adopt = useCallback(
    async (me: SignedInUser, editsWhenAsked = editCount()) => {
      await claimDevice(me.id);
      void saveMe(me);
      confirmed.current = true;
      setUser(me);
      loadFromServer(me, editsWhenAsked);
    },
    [editCount, setUser, loadFromServer],
  );

  /** Where a signed-in account may be: an unverified one only on Verify, a verified one not on a
   * signed-out screen (Verify is among them, so a verified account leaves it for Inbox). */
  const route = useCallback(
    (me: SignedInUser, path: string) => {
      if (me.email_verified_at === null) {
        if (path !== ROUTES.verify) router.replace(ROUTES.verify);
      } else if (SIGNED_OUT_PATHS.includes(path)) {
        showSplash("enter");
        router.replace(ROUTES.inbox);
      }
    },
    [router, showSplash],
  );

  /** Asks `GET /me` on `path`; returns the cancel for a check a newer one replaced. */
  const check = useCallback(
    (path: string) => {
      let current = true;
      const publicPage = PUBLIC_PATHS.includes(path);
      const editsWhenAsked = editCount();
      // Offline, the account and its settings come from the device until /me answers (AP-2)
      if (!publicPage)
        void readMe<SignedInUser>().then((me) => {
          if (!current || !me || userRef.current) return;
          setUser(me);
          loadFromServer(me, editsWhenAsked);
        });
      api("/me")
        .finally(() => setSessionChecked(true))
        .then(async (response) => {
          if (!current) return;
          if (response.status === 401) {
            confirmed.current = false;
            setUser(null);
            if (!publicPage) router.replace(signInBack(path));
            return;
          }
          if (!response.ok) return;
          const me: SignedInUser = await response.json();
          if (!current) return;
          await adopt(me, editsWhenAsked);
          route(me, path);
        })
        .catch(() => {});
      return () => {
        current = false;
      };
    },
    [router, setUser, userRef, loadFromServer, editCount, adopt, route],
  );

  // Runs on a screen change only, not when the account changes: a code accepted on /verify must
  // still reach Setup, not Inbox
  const onScreen = useEffectEvent((path: string) => {
    if (!confirmed.current) return check(path);
    if (userRef.current) route(userRef.current, path);
  });
  useEffect(() => onScreen(pathname), [pathname]);

  // Back in the app: the session may have ended, or settings changed on another device
  const onVisible = useEffectEvent(() => {
    if (document.visibilityState === "visible" && confirmed.current)
      check(pathname);
  });
  useEffect(() => {
    const visible = () => onVisible();
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, []);

  // An unverified account can only stay on /verify. The way out of /verify for a verified user is
  // the session check above, so a code accepted on /verify can still open Setup, not Inbox
  useEffect(() => {
    if (user?.email_verified_at === null && pathname !== ROUTES.verify)
      router.replace(ROUTES.verify);
  }, [user, pathname, router]);

  // A 403 with code auth.email_unverified from any API call opens /verify
  useEffect(() => {
    const unverified = () => {
      if (pathname !== ROUTES.verify) router.replace(ROUTES.verify);
    };
    window.addEventListener(EMAIL_UNVERIFIED, unverified);
    return () => window.removeEventListener(EMAIL_UNVERIFIED, unverified);
  }, [pathname, router]);

  // UX-44, AA-E6: a session that ended elsewhere opens Sign in and comes back to this screen
  // afterwards. Nothing is wiped: the same account signing in again keeps its unsynced changes.
  useEffect(() => {
    const expired = () => {
      // Signed out already: a plain visit is the auth gate's job, without the toast
      if (!userRef.current) return;
      confirmed.current = false;
      setUser(null);
      showSplash("leave");
      showToast(t("auth.session_expired"));
      router.replace(
        signInBack(window.location.pathname + window.location.search),
      );
    };
    window.addEventListener(SESSION_EXPIRED, expired);
    return () => window.removeEventListener(SESSION_EXPIRED, expired);
  }, [router, showToast, setUser, userRef, showSplash]);

  const signOut = useCallback(
    async (everywhere = false) => {
      // The loading screen covers the wipe until Sign in is there
      showSplash("leave");
      const path = everywhere ? "/auth/logout-everywhere" : "/auth/logout";
      const response = await api(path, { method: "POST" }).catch(() => null);
      // Offline, this device is still wiped at once; the server session ends when it expires
      // (AA §2.4). Other devices can only be signed out from the server, so that waits for a
      // connection.
      if (everywhere) {
        // Held back: still signed in, so the loading screen goes again
        const stay = (message: string) => {
          showSplash(null);
          showToast(message);
        };
        if (!response) return stay(t("app.offline"));
        if (!response.ok && response.status !== 401) {
          const body = await response.json().catch(() => null);
          return stay(
            t("error.generic", { request_id: body?.error?.request_id ?? "" }),
          );
        }
      }
      await wipeDevice();
      clearThemePalette();
      document.documentElement.setAttribute("data-page-view", "flat");
      forgetNotes();
      forgetConflicts();
      clearRecent();
      confirmed.current = false;
      setUser(null);
      reset();
      document.documentElement.removeAttribute("data-theme");
      router.replace(ROUTES.signIn);
    },
    [router, showToast, setUser, reset, showSplash],
  );

  return { sessionChecked, signOut, adopt };
}
