import { t } from "../../../copy";
import type { SelectOption } from "../../../components/SelectDropdown";

/** The value of "Automatic": follow the device's time zone. */
export const AUTO_TIME_ZONE = "auto";

const POPULAR_TIME_ZONES: ReadonlyArray<SelectOption<string>> = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  // Asia & Pacific
  { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh (UTC+07:00)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+07:00)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+08:00)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (UTC+08:00)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+09:00)" },
  { value: "Asia/Seoul", label: "Seoul (UTC+09:00)" },
  { value: "Asia/Shanghai", label: "Shanghai / Beijing (UTC+08:00)" },
  { value: "Asia/Taipei", label: "Taipei (UTC+08:00)" },
  { value: "Asia/Jakarta", label: "Jakarta (UTC+07:00)" },
  { value: "Asia/Kolkata", label: "Kolkata / Mumbai (UTC+05:30)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+04:00)" },
  // Europe
  { value: "Europe/London", label: "London (UTC+00:00 / BST)" },
  { value: "Europe/Paris", label: "Paris (UTC+01:00 / CEST)" },
  { value: "Europe/Berlin", label: "Berlin (UTC+01:00 / CEST)" },
  { value: "Europe/Rome", label: "Rome (UTC+01:00 / CEST)" },
  { value: "Europe/Madrid", label: "Madrid (UTC+01:00 / CEST)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (UTC+01:00 / CEST)" },
  { value: "Europe/Zurich", label: "Zurich (UTC+01:00 / CEST)" },
  // Americas
  { value: "America/New_York", label: "New York (Eastern Time)" },
  { value: "America/Chicago", label: "Chicago (Central Time)" },
  { value: "America/Denver", label: "Denver (Mountain Time)" },
  { value: "America/Los_Angeles", label: "Los Angeles (Pacific Time)" },
  { value: "America/Toronto", label: "Toronto (Eastern Time)" },
  { value: "America/Vancouver", label: "Vancouver (Pacific Time)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Mexico_City", label: "Mexico City (CST)" },
  // Oceania
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
];

const readable = (zone: string) => zone.replace(/_/g, " ");

/**
 * The Time zone choices: Automatic first, then the device's zone and the saved one when they
 * aren't among the popular zones, then the popular zones.
 */
export function timeZoneOptions(
  deviceZone: string,
  savedZone: string | undefined,
): SelectOption<string>[] {
  const listed = new Set(POPULAR_TIME_ZONES.map((zone) => zone.value));
  const options: SelectOption<string>[] = [
    {
      value: AUTO_TIME_ZONE,
      label: t("settings.time_zone_auto", { zone: deviceZone }),
    },
  ];
  const addUnlisted = (zone: string | undefined, label: string) => {
    if (!zone || zone === AUTO_TIME_ZONE || listed.has(zone)) return;
    options.push({ value: zone, label });
    listed.add(zone);
  };
  addUnlisted(deviceZone, `${readable(deviceZone)} (Device)`);
  if (savedZone) addUnlisted(savedZone, readable(savedZone));
  return [...options, ...POPULAR_TIME_ZONES];
}
