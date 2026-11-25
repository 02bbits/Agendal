import type { AccountSettings } from "@/ui/features/settings/types";
import { readStoredSetting } from "@/ui/features/shell/routes";
import { setTimeZone } from "@/lib/clock";

/** The signed-in user, as `GET /user` returns it. */
export interface SignedInUser {
  id: number;
  email: string;
  display_name: string | null;
  email_verified_at?: string | null;
  theme?: AccountSettings["theme"];
  week_start?: AccountSettings["weekStart"];
  time_format?: AccountSettings["timeFormat"];
  remember_device?: boolean;
  theme_palette?: string;
  page_view?: "flat" | "full";
  timezone?: string;
  timezone_auto?: boolean;
  two_factor_enabled?: boolean;
}

/** The settings as `PATCH /me` names them. */
const SETTING_FIELDS = {
  theme: "theme",
  weekStart: "week_start",
  timeFormat: "time_format",
  rememberDevice: "remember_device",
  pageView: "page_view",
  palette: "theme_palette",
  timezone: "timezone",
  timezoneAuto: "timezone_auto",
} as const;

export const PAGE_VIEW_KEY = "agendal.page_view";
export const TIMEZONE_KEY = "agendal.timezone";
export const TIMEZONE_AUTO_KEY = "agendal.timezone_auto";

export const DEFAULT_SETTINGS: AccountSettings = {
  theme: "system",
  weekStart: "mon",
  timeFormat: "24h",
  rememberDevice: true,
  pageView: "flat",
  palette: "default",
  timezone: "UTC",
  timezoneAuto: true,
};

// The server's value wins. Only an answer without the field (an older API) falls back to this
// device's copy, which sign-out and a different account wipe
export const storedPageView = (): AccountSettings["pageView"] =>
  readStoredSetting(PAGE_VIEW_KEY) === "full" ? "full" : "flat";

const storedTimezone = (): string | undefined =>
  readStoredSetting(TIMEZONE_KEY) || undefined;

const storedTimezoneAuto = (): boolean => {
  const saved = readStoredSetting(TIMEZONE_AUTO_KEY);
  return saved === null ? true : saved === "true";
};

/** The settings a `/me` answer holds; the app's clock follows its time zone at once. */
export function settingsOf(me: SignedInUser): AccountSettings {
  const timezoneAuto = me.timezone_auto ?? storedTimezoneAuto();
  const timezone = me.timezone ?? storedTimezone() ?? DEFAULT_SETTINGS.timezone;
  setTimeZone(timezoneAuto ? undefined : timezone);
  return {
    theme: me.theme ?? DEFAULT_SETTINGS.theme,
    weekStart: me.week_start ?? DEFAULT_SETTINGS.weekStart,
    timeFormat: me.time_format ?? DEFAULT_SETTINGS.timeFormat,
    rememberDevice: me.remember_device ?? DEFAULT_SETTINGS.rememberDevice,
    pageView: me.page_view ?? storedPageView(),
    palette: me.theme_palette ?? DEFAULT_SETTINGS.palette,
    timezone,
    timezoneAuto,
  };
}

/** A settings change as the `PATCH /me` body names it; settings the server doesn't keep drop out. */
export function settingsPatchBody(
  patch: Partial<AccountSettings>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch)
      .map(([key, value]) => [
        SETTING_FIELDS[key as keyof typeof SETTING_FIELDS],
        value,
      ])
      .filter(([field]) => Boolean(field)),
  );
}
