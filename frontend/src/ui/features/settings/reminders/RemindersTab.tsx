import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { BellIcon } from "../../../components/icons";
import { Switch } from "../../../components/Switch";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
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
    <div className="space-y-4">
      <Switch
        icon={<BellIcon size={20} />}
        label={t("settings.reminders_switch")}
        description={why}
        checked={usable && subscribed}
        disabled={!usable || busy}
        onChange={(on) => void toggle(on)}
        divider={false}
        className="py-0"
      />
      <section className="space-y-2 border-t border-separator/40 pt-4">
        <Button
          variant="secondary"
          disabled={!usable || !subscribed || busy}
          onClick={() => void test()}
        >
          {t("settings.push_test")}
        </Button>
        <p
          role="status"
          className={cx(
            "m-0 min-h-5 text-footnote transition-colors",
            isSuccess
              ? "text-emerald-500 font-medium"
              : message
                ? "text-error"
                : "text-ink-secondary",
          )}
        >
          {message ? t(message) : null}
        </p>
      </section>
    </div>
  );
}
