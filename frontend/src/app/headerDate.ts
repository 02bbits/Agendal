import { localTime, now, timeZone, today } from "@/lib/clock";
import { formatLongDate } from "@/ui";

// Inbox date overline, e.g. "Thursday, 29 October". Reads the time through the IM-05 clock.
export function headerDate(zone = timeZone(), at = now()): string {
  return formatLongDate(today(zone, at));
}

/** Notifies when local midnight passes or the window becomes visible (LV-E1). */
export function subscribeHeaderDate(callback: () => void): () => void {
  const [h, m] = localTime(timeZone(), now()).split(":").map(Number) as [
    number,
    number,
  ];
  const msToMidnight =
    ((24 * 60 - (h * 60 + m)) * 60 - now().getSeconds()) * 1000 + 500;
  const timer = setTimeout(callback, msToMidnight);
  const onVisible = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      callback();
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    clearTimeout(timer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}
