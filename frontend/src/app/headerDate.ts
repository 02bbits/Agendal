import { now, timeZone, today } from "@/lib/clock";
import { formatLongDate } from "@/ui";

// Inbox date overline, e.g. "Thursday, 29 October". Reads the time through the IM-05 clock.
export function headerDate(zone = timeZone(), at = now()): string {
  return formatLongDate(today(zone, at));
}
