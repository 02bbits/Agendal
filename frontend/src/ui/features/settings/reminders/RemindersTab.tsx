import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import {
  AlertCircleIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
} from "../../../components/icons";
import { Switch } from "../../../components/Switch";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import { SettingsHeading } from "../SettingsSection";
import { useDeviceReminders } from "./useDeviceReminders";

/**
 * Settings > Reminders (TK-6, #186): turn reminders on or off for this device, and send a test
 * notification the way a real reminder goes. When the switch can't be used, the line under it
 * says why.
 */
export function RemindersTab(): ReactElement {
  const { status, ready, subscribed, busy, message, toggle, test } =
    useDeviceReminders();
  const usable = ready === true && (status === "ask" || status === "granted");

  const why =
    ready === null
      ? t("app.vapid_desc_checking")
      : !ready
        ? t("app.vapid_desc_missing")
        : status === "denied"
          ? t("app.perm_desc_blocked")
          : status === "install"
            ? `${t("app.install_for_reminders")} ${t("app.install_ios")}`
            : status === "unsupported"
              ? t("app.perm_desc_unsupported")
              : t("app.notification_diag_desc");

  const isSuccess = message === "settings.push_test_sent";

  return (
    <div className="space-y-6">
      {/* Device Reminders Section */}
      <section className="space-y-2">
        <SettingsHeading>{t("settings.tab_reminders")}</SettingsHeading>
        <div className="overflow-hidden rounded-box border border-separator bg-surface p-4 shadow-xs transition-colors">
          <Switch
            icon={
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-fill text-ink">
                <BellIcon size={18} />
              </span>
            }
            label={t("settings.reminders_switch")}
            description={why}
            checked={usable && subscribed}
            disabled={!usable || busy}
            onChange={(on) => void toggle(on)}
            divider={false}
            className="py-0"
          />
        </div>
      </section>

      {/* Test Notification Section */}
      <section className="space-y-2">
        <SettingsHeading>{t("settings.push_test")}</SettingsHeading>
        <div className="overflow-hidden rounded-box border border-separator bg-surface p-4 shadow-xs transition-colors space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-body font-medium text-ink m-0">
                {t("settings.push_test")}
              </p>
              <p className="text-footnote text-ink-secondary m-0">
                {t("app.notification_diag_desc")}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!usable || !subscribed || busy}
              onClick={() => void test()}
              className="shrink-0 gap-2 cursor-pointer self-start sm:self-auto"
            >
              <BellIcon size={15} />
              <span>{t("settings.push_test")}</span>
            </Button>
          </div>

          <p
            role="status"
            className={cx(
              "m-0 min-h-5 text-footnote transition-colors",
              isSuccess
                ? "text-emerald-500 font-medium flex items-center gap-1.5"
                : message
                  ? "text-error flex items-center gap-1.5"
                  : "text-ink-secondary",
            )}
          >
            {message ? (
              <>
                {isSuccess ? (
                  <CheckCircleIcon size={15} className="shrink-0" />
                ) : (
                  <AlertCircleIcon size={15} className="shrink-0" />
                )}
                <span>{t(message)}</span>
              </>
            ) : null}
          </p>
        </div>
      </section>

      {/* Informative Tip Card */}
      <div className="flex items-start gap-3 rounded-box border border-separator/60 bg-fill/15 p-3.5 text-footnote text-ink-secondary">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-secondary">
          <ClockIcon size={16} />
        </span>
        <p className="m-0 leading-relaxed">
          {t("task.push_explainer")} {t("task.push_denied").split(".")[0]}.
        </p>
      </div>
    </div>
  );
}
