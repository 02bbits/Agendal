import { useMemo, useState, type ReactElement } from "react";
import { timeZone as deviceTimeZone } from "../../../../lib/clock";
import { SelectDropdown } from "../../../components/SelectDropdown";
import { t } from "../../../copy";
import { readStoredSetting, writeStoredSetting } from "../../shell/routes";
import type { AccountSettings, ChangeSettings, PageViewMode } from "../types";
import { AUTO_TIME_ZONE, timeZoneOptions } from "./timeZones";

const DATE_FORMAT_KEY = "agendal.date_format";
const DEFAULT_DATE_FORMAT = "DD-MM-YYYY";
const DATE_FORMATS = ["DD-MM-YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "D MMM YYYY"];
const DEFAULT_TIME_ZONE = "UTC";

/** Settings > General: date and time, and on desktop the page view. */
export function GeneralTab({
  settings,
  onChange,
  isDesktop,
}: {
  settings: AccountSettings;
  onChange: ChangeSettings;
  /** Page view only changes the layout from 768px: a phone is always flat. */
  isDesktop: boolean;
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

      {isDesktop && (
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
      )}
    </div>
  );
}
