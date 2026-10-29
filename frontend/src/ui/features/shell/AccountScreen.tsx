import { t } from "../../copy";
import { Button } from "../../components/Button";
import {
  ArrowUpIcon,
  BellIcon,
  ChevronRightIcon,
} from "../../components/icons";
import { NavBar } from "../../components/NavBar";
import { Segmented } from "../../components/Segmented";
import { Switch } from "../../components/Switch";

export type ThemeSetting = "system" | "light" | "dark";
export type WeekStart = "mon" | "sun";
export type TimeFormat = "24h" | "12h";

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
}: AccountScreenProps) {
  return (
    <div className="pb-8">
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
          <p className="font-serif text-[19px] leading-[26px] font-semibold">
            {name}
          </p>
          <p className="text-footnote text-ink-secondary">{email}</p>
        </div>
      </section>

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
            <span className="inline-flex text-ink-secondary" aria-hidden="true">
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
            <span className="inline-flex text-ink-secondary" aria-hidden="true">
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

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button variant="destructive" fullWidth onClick={onSignOut}>
          {t("app.sign_out")}
        </Button>
        {onSignOutEverywhere && (
          <button
            type="button"
            className="focus-ring min-h-11 cursor-pointer rounded-tile border-0 bg-transparent px-2 text-callout font-semibold text-primary"
            onClick={onSignOutEverywhere}
          >
            {t("auth.signout_everywhere")}
          </button>
        )}
      </div>
    </div>
  );
}
