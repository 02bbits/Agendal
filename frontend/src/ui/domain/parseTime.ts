/**
 * Reads a time someone typed into "HH:MM" (24-hour), or null when it isn't one.
 * Takes 9, 09, 930, 0930, 9:30, 9.30, 9h30, 21h, 9pm, 9:30 pm, 12am and the like.
 */
export function parseTime(input: string): string | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  const match = text.match(
    /^(\d{1,2})(?:[:.h](\d{2})|(\d{2}))?h?(am|pm|a|p)?$/,
  );
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? match[3] ?? 0);
  const half = match[4]?.charAt(0);
  if (minute > 59) return null;
  if (half) {
    if (hour < 1 || hour > 12) return null;
    if (half === "a" && hour === 12) hour = 0;
    if (half === "p" && hour < 12) hour += 12;
  }
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
