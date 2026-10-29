import { now, timeZone } from "@/lib/clock";

// Inbox date overline, e.g. "Thursday, 29 October". Reads the time through the IM-05 clock.
export function headerDate(zone = timeZone(), at = now()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")}`;
}
