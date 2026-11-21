import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { t, type AccountSettings } from "@/ui";
import { writeStoredSetting } from "@/ui/features/shell/routes";
import { api } from "@/lib/api";
import { setTimeZone } from "@/lib/clock";
import { saveMe } from "@/lib/localStore";
import {
  DEFAULT_SETTINGS,
  PAGE_VIEW_KEY,
  settingsOf,
  settingsPatchBody,
  storedPageView,
  TIMEZONE_AUTO_KEY,
  TIMEZONE_KEY,
  type SignedInUser,
} from "./signedInUser";
import type { ShowToast } from "./useToast";
import { useSettingsOnPage } from "./useSettingsOnPage";

/** Tells the sync a time zone change moved what "today" is. */
const SYNC_EVENT = "agendal.sync";

/** Keeps a time zone change on this device and moves the app's clock to it at once. */
function applyTimeZone(
  patch: Partial<AccountSettings>,
  current: AccountSettings,
) {
  if (patch.timezone === undefined && patch.timezoneAuto === undefined) return;
  if (patch.timezone !== undefined)
    writeStoredSetting(TIMEZONE_KEY, patch.timezone);
  if (patch.timezoneAuto !== undefined)
    writeStoredSetting(TIMEZONE_AUTO_KEY, String(patch.timezoneAuto));
  setTimeZone(current.timezoneAuto ? undefined : current.timezone);
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/**
 * The signed-in user's settings: loaded from `GET /me`, changed here at once and saved with
 * `PATCH /me`. A refused save puts the old values back; offline the change stays on this device
 * until the sync arrives (IM-52).
 */
export function useAccountSettings({
  user,
  userRef,
  showToast,
}: {
  user: SignedInUser | null;
  userRef: RefObject<SignedInUser | null>;
  showToast: ShowToast;
}) {
  const [settings, setSettings] = useState<AccountSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  // Counts changes made on this device, so a session check sent before one can't undo it
  const edits = useRef(0);

  // The page view this device saw last, before /me answers
  useEffect(() => {
    const saved = storedPageView();
    queueMicrotask(() =>
      setSettings((prev) =>
        prev.pageView === saved ? prev : { ...prev, pageView: saved },
      ),
    );
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useSettingsOnPage(settings, user !== null, edits);

  const replace = useCallback((next: AccountSettings) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  /** A `/me` answer, unless this device changed a setting after the request went out. */
  const loadFromServer = useCallback(
    (me: SignedInUser, editsWhenAsked: number) => {
      if (edits.current === editsWhenAsked) replace(settingsOf(me));
    },
    [replace],
  );

  const editCount = useCallback(() => edits.current, []);
  const reset = useCallback(() => replace(DEFAULT_SETTINGS), [replace]);

  const changeSettings = useCallback(
    (patch: Partial<AccountSettings>) => {
      edits.current += 1;
      const before = settingsRef.current;
      const revert = Object.fromEntries(
        Object.keys(patch).map((key) => [
          key,
          before[key as keyof AccountSettings],
        ]),
      );
      // A zone picked by hand stops following the device
      if (patch.timezone && patch.timezoneAuto === undefined)
        patch.timezoneAuto = false;
      replace({ ...before, ...patch });
      if (patch.pageView) writeStoredSetting(PAGE_VIEW_KEY, patch.pageView);
      applyTimeZone(patch, settingsRef.current);

      const body = settingsPatchBody(patch);
      if (Object.keys(body).length === 0) return;
      api("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((response) => {
          if (response.ok && userRef.current)
            void saveMe({ ...userRef.current, ...body });
          if (response.ok || response.status === 401) return;
          replace({ ...settingsRef.current, ...revert });
          showToast(t("error.generic", { request_id: "" }));
        })
        .catch(() => {});
    },
    [replace, showToast, userRef],
  );

  return { settings, changeSettings, loadFromServer, editCount, reset };
}

export type AccountSettingsState = ReturnType<typeof useAccountSettings>;
