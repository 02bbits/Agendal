import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { cx } from "../../../components/cx";
import { LockIcon } from "../../../components/icons";
import { Switch } from "../../../components/Switch";
import { t } from "../../../copy";
import { MAX_DISPLAY_NAME_LENGTH } from "../../auth/validation";
import { SettingsHeading } from "../SettingsSection";
import type { ChangeSettings } from "../types";
import type { DisplayNameField } from "./useDisplayName";

const NAME_ERROR_ID = "settings-name-error";

/** Settings > Account: name, email, password, two-step verification, this device. Sign out is on Settings itself (#168). */
export function AccountTab({
  email,
  name,
  rememberDevice,
  onChange,
  onChangePassword,
  twoFactor,
}: {
  email: string;
  name: DisplayNameField;
  rememberDevice: boolean;
  onChange: ChangeSettings;
  onChangePassword: () => void;
  twoFactor: {
    enabled: boolean;
    busy: boolean;
    toggle: (next: boolean) => void;
  };
}): ReactElement {
  return (
    <>
      <section>
        <SettingsHeading className="mb-1.5">
          {t("settings.name_heading")}
        </SettingsHeading>
        <span className="sr-only">{name.value}</span>
        <input
          type="text"
          value={name.value}
          onChange={(e) => name.change(e.target.value)}
          onBlur={name.save}
          placeholder={t("settings.name_placeholder")}
          aria-invalid={name.error ? true : undefined}
          aria-describedby={name.error ? NAME_ERROR_ID : undefined}
          className={cx(
            "w-full rounded-lg border bg-fill/30 px-3 py-2 text-body text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-primary/80",
            name.error ? "border-error" : "border-separator/60",
          )}
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-footnote">
          <span
            id={NAME_ERROR_ID}
            role={name.error ? "alert" : undefined}
            className="min-w-0 text-error"
          >
            {name.error ? t(name.error) : null}
          </span>
          <span className="shrink-0 text-ink-secondary">
            {[...name.value.trim()].length}/{MAX_DISPLAY_NAME_LENGTH}
          </span>
        </div>
      </section>

      <section>
        <SettingsHeading className="mb-1">
          {t("settings.email_heading")}
        </SettingsHeading>
        <p className="m-0 text-body text-ink font-medium break-words [overflow-wrap:anywhere]">
          {email}
        </p>
      </section>

      <section>
        <SettingsHeading className="mb-1.5">
          {t("settings.password_heading")}
        </SettingsHeading>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-lg"
          onClick={onChangePassword}
        >
          {t("settings.change_password")}
        </Button>
      </section>

      <section className="border-t border-separator/40 pt-4">
        <SettingsHeading className="mb-1.5">
          {t("settings.two_factor_heading")}
        </SettingsHeading>
        <Switch
          icon={<LockIcon size={20} />}
          label={t("settings.two_factor_label")}
          checked={twoFactor.enabled}
          disabled={twoFactor.busy}
          onChange={twoFactor.toggle}
          divider={false}
          className="py-0"
        />
      </section>

      <section className="border-t border-separator/40 pt-4">
        <Switch
          label={t("app.remember_device")}
          checked={rememberDevice}
          onChange={(next) => onChange({ rememberDevice: next })}
          divider={false}
          className="py-0"
        />
      </section>
    </>
  );
}
