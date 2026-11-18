import { useMemo, useState, type ReactElement } from "react";
import { timeZone as deviceTimeZone } from "../../../../lib/clock";
import { ArrowUpIcon, ChevronRightIcon } from "../../../components/icons";
import { SelectDropdown } from "../../../components/SelectDropdown";
import { t } from "../../../copy";
import { readStoredSetting, writeStoredSetting } from "../../shell/routes";
import { SettingsHeading } from "../SettingsSection";
import type { AccountSettings, ChangeSettings, PageViewMode } from "../types";
import { AUTO_TIME_ZONE, timeZoneOptions } from "./timeZones";

const DATE_FORMAT_KEY = "agendal.date_format";
const DEFAULT_DATE_FORMAT = "DD-MM-YYYY";
const DATE_FORMATS = ["DD-MM-YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "D MMM YYYY"];
const DEFAULT_TIME_ZONE = "UTC";

/** Settings > General: date and time, the page view, installing the app. */
export function GeneralTab({
  settings,
  onChange,
  onInstall,
}: {
  settings: AccountSettings;
  onChange: ChangeSettings;
  /** Only while this browser can install the app (AP-1). */
  onInstall?: () => void;
}): ReactElement {
  const [dateFormat, setDateFormat] = useState(
    () => readStoredSetting(DATE_FORMAT_KEY) || DEFAULT_DATE_FORMAT,
  );
  const deviceZone = deviceTimeZone();
  const zones = useMemo(
    () => timeZoneOptions(deviceZone, settings.timezone),
    [deviceZone, settings.timezone],
  );

  const chooseTimeZone = (zone: string) =>
    onChange(
      zone === AUTO_TIME_ZONE
        ? { timezoneAuto: true }
        : { timezone: zone, timezoneAuto: false },
    );

  const chooseDateFormat = (format: string) => {
    setDateFormat(format);
    writeStoredSetting(DATE_FORMAT_KEY, format);
  };

  return (
    <>
      <div className="pt-2">
        <SettingsHeading className="mb-3.5">
          {t("settings.date_time")}
        </SettingsHeading>

        <div className="space-y-4">
          <SelectDropdown
            label={t("settings.time_zone")}
            value={
              settings.timezoneAuto !== false
                ? AUTO_TIME_ZONE
                : (settings.timezone ?? DEFAULT_TIME_ZONE)
            }
            onChange={chooseTimeZone}
            options={zones}
          />

          <SelectDropdown
            label={t("app.time_format")}
            value={settings.timeFormat}
            onChange={(timeFormat) => onChange({ timeFormat })}
            roleMode="radio"
            options={[
              { value: "24h", label: t("app.time_24h") },
              { value: "12h", label: t("app.time_12h") },
            ]}
          />

          <SelectDropdown
            label={t("settings.date_format")}
            value={dateFormat}
            onChange={chooseDateFormat}
            options={DATE_FORMATS.map((format) => ({
              value: format,
              label: format,
            }))}
          />

          <SelectDropdown
            label={t("app.week_start")}
            value={settings.weekStart}
            onChange={(weekStart) => onChange({ weekStart })}
            roleMode="radio"
            options={[
              { value: "mon", label: t("app.week_mon") },
              { value: "sun", label: t("app.week_sun") },
            ]}
          />

          <div className="pt-2">
            <SelectDropdown
              label={t("app.page_view")}
              value={settings.pageView ?? "flat"}
              onChange={(pageView) =>
                onChange({ pageView: pageView as PageViewMode })
              }
              roleMode="radio"
              options={[
                { value: "flat", label: t("app.view_flat") },
                { value: "full", label: t("app.view_full") },
              ]}
            />
          </div>
        </div>
      </div>

      {onInstall && (
        <div className="border-t border-separator/40 pt-4 space-y-2">
          <button
            type="button"
            className="focus-ring cursor-pointer bg-transparent disabled:cursor-default disabled:opacity-40 flex min-h-11 w-full items-center gap-3 py-1.5 text-left text-body text-ink hover:bg-fill/40 rounded-lg px-2"
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
        </div>
      )}
    </>
  );
}
