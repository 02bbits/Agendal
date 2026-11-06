import { useState } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import {
  ArrowUpIcon,
  BellIcon,
  ChevronRightIcon,
} from "../../components/icons";
import { NavBar } from "../../components/NavBar";
import { Segmented } from "../../components/Segmented";
import { Switch } from "../../components/Switch";
import type { TimeFormat, WeekStart } from "../../domain/types";

export type ThemeSetting = "system" | "light" | "dark";

export interface AccountSettings {
  theme: ThemeSetting;
  weekStart: WeekStart;
  timeFormat: TimeFormat;
  rememberDevice: boolean;
}

export interface AccountScreenProps {
  name: string;
  email: string;
  settings: AccountSettings;
  /** Saving goes through `PATCH /me` (IM-16, platform owner). */
  onChange: (patch: Partial<AccountSettings>) => void;
  onBack: () => void;
  onSignOut: () => void;
  /** Should; omitted until AA ships it. */
  onSignOutEverywhere?: () => void;
  /** Shown when the app can be installed (AP-1). */
  onInstall?: () => void;
  /** Reminders permission state text, e.g. "Allowed" (TK-6, Should). */
  remindersStatus?: string;
  notificationSupported?: boolean;
  notificationPermission?: NotificationPermission;
  vapidConfigured?: boolean | null;
  onEnableNotifications?: () => void;
  onSendTestNotification?: () => void;
}

export function AccountScreen({
  name,
  email,
  settings,
  onChange,
  onBack,
  onSignOut,
  onSignOutEverywhere,
  onInstall,
  remindersStatus,
  notificationSupported = true,
  notificationPermission = "default",
  vapidConfigured = null,
  onEnableNotifications,
  onSendTestNotification,
}: AccountScreenProps) {
  const [tab, setTab] = useState<"general" | "notifications">("general");

  return (
    <div className="w-full max-w-[580px] pb-8">
      <NavBar
        backLabel={t("common.back")}
        onBack={onBack}
        title={t("nav.account")}
      />
      <section
        className="flex items-center gap-3 border-b border-separator py-3 [&_p]:m-0"
        aria-label={t("nav.account")}
      >
        <span
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-heading font-semibold text-primary"
          aria-hidden="true"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="text-heading font-semibold">{name}</p>
          <p className="text-footnote text-ink-secondary">{email}</p>
        </div>
      </section>

      <div className="mt-4 mb-6">
        <Segmented
          label={t("nav.account")}
          value={tab}
          onChange={(val) => setTab(val as "general" | "notifications")}
          options={[
            { value: "general", label: t("app.tab_general") },
            { value: "notifications", label: t("app.tab_notifications") },
          ]}
        />
      </div>

      {tab === "general" && (
        <>
          <h2 className="text-overline font-semibold uppercase mt-6 mb-2 text-ink-secondary">
            {t("app.appearance")}
          </h2>
          <Segmented
            label={t("app.appearance")}
            value={settings.theme}
            onChange={(theme) => onChange({ theme })}
            options={[
              { value: "system", label: t("app.theme_system") },
              { value: "light", label: t("app.theme_light") },
              { value: "dark", label: t("app.theme_dark") },
            ]}
          />
          <h2 className="text-overline font-semibold uppercase mt-6 mb-2 text-ink-secondary">
            {t("app.week_start")}
          </h2>
          <Segmented
            label={t("app.week_start")}
            value={settings.weekStart}
            onChange={(weekStart) => onChange({ weekStart })}
            options={[
              { value: "mon", label: t("app.week_mon") },
              { value: "sun", label: t("app.week_sun") },
            ]}
          />
          <h2 className="text-overline font-semibold uppercase mt-6 mb-2 text-ink-secondary">
            {t("app.time_format")}
          </h2>
          <Segmented
            label={t("app.time_format")}
            value={settings.timeFormat}
            onChange={(timeFormat) => onChange({ timeFormat })}
            options={[
              { value: "24h", label: t("app.time_24h") },
              { value: "12h", label: t("app.time_12h") },
            ]}
          />

          <h2 className="text-overline font-semibold uppercase mt-6 mb-2 text-ink-secondary">
            {t("app.this_device")}
          </h2>
          <div className="flex flex-col">
            <Switch
              label={t("app.remember_device")}
              checked={settings.rememberDevice}
              onChange={(rememberDevice) => onChange({ rememberDevice })}
            />
            {remindersStatus && (
              <div className="flex min-h-11 w-full items-center gap-3 border-b border-separator py-1 text-left text-body text-ink">
                <span
                  className="inline-flex text-ink-secondary"
                  aria-hidden="true"
                >
                  <BellIcon size={18} />
                </span>
                <span className="flex-1">{t("app.reminders")}</span>
                <span className="text-ink-secondary">{remindersStatus}</span>
              </div>
            )}
            {onInstall && (
              <button
                type="button"
                className="focus-ring cursor-pointer bg-transparent disabled:cursor-default disabled:opacity-40 flex min-h-11 w-full items-center gap-3 border-b border-separator py-1 text-left text-body text-ink"
                onClick={onInstall}
              >
                <span
                  className="inline-flex text-ink-secondary"
                  aria-hidden="true"
                >
                  <ArrowUpIcon size={18} />
                </span>
                <span className="flex-1">{t("app.install_app")}</span>
                <ChevronRightIcon
                  size={18}
                  className="shrink-0 text-ink-tertiary"
                />
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              variant="destructive"
              className="w-full max-w-[320px]"
              onClick={onSignOut}
            >
              {t("app.sign_out")}
            </Button>
            {onSignOutEverywhere && (
              <button
                type="button"
                className="focus-ring min-h-11 cursor-pointer rounded-tile border-0 bg-transparent px-2 text-callout font-semibold text-primary hover:bg-fill"
                onClick={onSignOutEverywhere}
              >
                {t("auth.signout_everywhere")}
              </button>
            )}
          </div>
        </>
      )}

      {tab === "notifications" && (
        <div className="flex flex-col gap-6" data-testid="notifications-tab">
          <section
            className="flex flex-col gap-4 rounded-2xl border border-separator/50 bg-surface p-5 shadow-xs"
            aria-label={t("app.notification_diag_title")}
          >
            <div>
              <h3 className="m-0 text-heading font-semibold text-ink">
                {t("app.notification_diag_title")}
              </h3>
              <p className="m-0 mt-1 text-footnote text-ink-secondary">
                {t("app.notification_diag_desc")}
              </p>
            </div>

            {/* Browser permission diagnostic */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-separator/40 bg-fill/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-callout font-medium text-ink">
                  {t("app.browser_permission")}
                </span>
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold",
                    !notificationSupported
                      ? "bg-fill text-ink-secondary"
                      : notificationPermission === "granted"
                        ? "bg-success/15 text-success"
                        : notificationPermission === "denied"
                          ? "bg-error/15 text-error"
                          : "bg-warning/15 text-warning",
                  )}
                >
                  <span
                    className={cx(
                      "size-2 rounded-full",
                      !notificationSupported
                        ? "bg-ink-tertiary"
                        : notificationPermission === "granted"
                          ? "bg-success"
                          : notificationPermission === "denied"
                            ? "bg-error"
                            : "bg-warning",
                    )}
                  />
                  {!notificationSupported
                    ? t("app.perm_unsupported")
                    : notificationPermission === "granted"
                      ? t("app.perm_enabled")
                      : notificationPermission === "denied"
                        ? t("app.perm_blocked")
                        : t("app.perm_not_configured")}
                </span>
              </div>
              <p className="m-0 text-footnote text-ink-secondary">
                {!notificationSupported
                  ? t("app.perm_desc_unsupported")
                  : notificationPermission === "granted"
                    ? t("app.perm_desc_enabled")
                    : notificationPermission === "denied"
                      ? t("app.perm_desc_blocked")
                      : t("app.perm_desc_not_configured")}
              </p>
            </div>

            {/* VAPID Server Status */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-separator/40 bg-fill/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-callout font-medium text-ink">
                  {t("app.server_push_service")}
                </span>
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold",
                    vapidConfigured === true
                      ? "bg-success/15 text-success"
                      : vapidConfigured === false
                        ? "bg-error/15 text-error"
                        : "bg-fill text-ink-secondary",
                  )}
                >
                  <span
                    className={cx(
                      "size-2 rounded-full",
                      vapidConfigured === true
                        ? "bg-success"
                        : vapidConfigured === false
                          ? "bg-error"
                          : "bg-ink-tertiary",
                    )}
                  />
                  {vapidConfigured === true
                    ? t("app.vapid_ready")
                    : vapidConfigured === false
                      ? t("app.vapid_missing")
                      : t("app.vapid_checking")}
                </span>
              </div>
              <p className="m-0 text-footnote text-ink-secondary">
                {vapidConfigured === true
                  ? t("app.vapid_desc_ready")
                  : vapidConfigured === false
                    ? t("app.vapid_desc_missing")
                    : t("app.vapid_desc_checking")}
              </p>
            </div>

            {/* Action buttons */}
            <div className="mt-2 flex flex-col gap-2.5">
              {notificationPermission !== "granted" ? (
                <Button
                  variant="primary"
                  disabled={!notificationSupported}
                  onClick={onEnableNotifications}
                >
                  {t("app.enable_notifications")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={onSendTestNotification}>
                  <BellIcon size={16} />
                  {t("app.send_test_notification")}
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
