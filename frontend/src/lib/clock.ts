// IM-05 (ADR-006): the only place the client reads the time or the device zone.
// Tests pin both: vi.setSystemTime() for now, setTimeZone() for the zone.
let zoneOverride: string | undefined;

export const now = () => new Date();

export const timeZone = () =>
  zoneOverride ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

export function setTimeZone(zone?: string) {
  zoneOverride = zone;
}

// Floating local date (YYYY-MM-DD) in a zone
export const today = (zone = timeZone(), at = now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);

// Floating local time (HH:mm) in a zone
export const localTime = (zone = timeZone(), at = now()) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
