import type { TimeFormat, WeekStart } from "../../domain/types";

export type ThemeSetting = "system" | "light" | "dark";
export type PageViewMode = "flat" | "full";
export type SettingsTab = "account" | "general" | "theme" | "sidebar";

/** The settings the app keeps for the signed-in user (synced through `PATCH /me` or this browser). */
export interface AccountSettings {
  theme: ThemeSetting;
  weekStart: WeekStart;
  timeFormat: TimeFormat;
  rememberDevice: boolean;
  pageView?: PageViewMode;
  palette?: string;
  timezone?: string;
  timezoneAuto?: boolean;
}

/** Saving goes through `PATCH /me` (IM-16, platform owner). */
export type ChangeSettings = (patch: Partial<AccountSettings>) => void;
