/**
 * Clock interface and implementations conforming to ADR-006.
 *
 * Requirements:
 * - Floating local dates (YYYY-MM-DD) and times (HH:mm)
 * - Absolute remind_at in UTC
 * - Pinned clock in tests (FakeClock) with time and timezone control
 * - Zero direct now() / Date.now() calls in business logic
 */

/**
 * System Clock reading the machine's real time.
 */
export class SystemClock {
  now() {
    return new Date();
  }

  nowMs() {
    return Date.now();
  }

  toISOString() {
    return this.now().toISOString();
  }

  today(timezone) {
    return formatLocalDate(this.now(), timezone);
  }

  time(timezone) {
    return formatLocalTime(this.now(), timezone);
  }

  toLocalParts(instant, timezone) {
    const d = typeof instant === 'number' ? new Date(instant) : instant;
    return getLocalParts(d, timezone);
  }
}

/**
 * FakeClock for tests with frozen, controllable time.
 */
export class FakeClock {
  constructor(initialTime = '2026-10-23T08:12:00+07:00') {
    this.currentTime = new Date(initialTime);
    if (isNaN(this.currentTime.getTime())) {
      throw new Error(`Invalid initialTime provided to FakeClock: ${initialTime}`);
    }
  }

  now() {
    return new Date(this.currentTime.getTime());
  }

  nowMs() {
    return this.currentTime.getTime();
  }

  toISOString() {
    return this.currentTime.toISOString();
  }

  today(timezone) {
    return formatLocalDate(this.currentTime, timezone);
  }

  time(timezone) {
    return formatLocalTime(this.currentTime, timezone);
  }

  toLocalParts(instant, timezone) {
    const d = typeof instant === 'number' ? new Date(instant) : instant;
    return getLocalParts(d, timezone);
  }

  /** Advance clock by milliseconds */
  advanceMs(ms) {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  /** Advance clock by seconds */
  advanceSeconds(seconds) {
    this.advanceMs(seconds * 1000);
  }

  /** Advance clock by minutes */
  advanceMinutes(minutes) {
    this.advanceMs(minutes * 60 * 1000);
  }

  /** Advance clock by hours */
  advanceHours(hours) {
    this.advanceMs(hours * 3600 * 1000);
  }

  /** Advance clock by days */
  advanceDays(days) {
    this.advanceMs(days * 86400 * 1000);
  }

  /** Pin clock to a new instant */
  setTime(time) {
    const next = new Date(time);
    if (isNaN(next.getTime())) {
      throw new Error(`Invalid time provided to setTime: ${time}`);
    }
    this.currentTime = next;
  }
}

/**
 * Format Date to local YYYY-MM-DD in the given timezone.
 */
export function formatLocalDate(date, timezone) {
  const parts = getLocalParts(date, timezone);
  return parts.dateString;
}

/**
 * Format Date to local HH:mm in the given timezone.
 */
export function formatLocalTime(date, timezone) {
  const parts = getLocalParts(date, timezone);
  return parts.timeString;
}

/**
 * Break an instant down into local wall-clock components for a given timezone.
 */
export function getLocalParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
    else if (part.type === 'hour') {
      const h = parseInt(part.value, 10);
      hour = h === 24 ? 0 : h;
    } else if (part.type === 'minute') minute = parseInt(part.value, 10);
    else if (part.type === 'second') second = parseInt(part.value, 10);
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateString: `${year}-${mm}-${dd}`,
    timeString: `${hh}:${min}`,
  };
}

/**
 * Compute UTC remind_at timestamp from floating local date/time + reminder offset + user timezone.
 * Conforms to ADR-006:
 * - Floating time + timezone -> UTC remind_at.
 * - Reminder offset: "5m", "15m", "30m", "1h", "1d", or "none".
 * - If no start_time, default reference is 09:00 on due_date.
 * - Returns ISO 8601 UTC string (e.g. "2026-10-25T02:00:00.000Z"), or null if reminder is "none".
 */
export function computeRemindAtUtc({ dueDate, startTime, reminder, timezone }) {
  if (!reminder || reminder === 'none') {
    return null;
  }

  const timeStr = startTime || '09:00';
  const targetWallInstant = parseWallClockInTimezone(dueDate, timeStr, timezone);

  const offsetMinutesMap = {
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '1d': 1440,
  };

  const offsetMinutes = offsetMinutesMap[reminder];
  if (offsetMinutes === undefined) {
    throw new Error(`Unknown reminder offset: ${reminder}`);
  }

  const remindAtTimestamp = targetWallInstant.getTime() - offsetMinutes * 60 * 1000;
  return new Date(remindAtTimestamp).toISOString();
}

/**
 * Convert a local wall-clock date (YYYY-MM-DD) and time (HH:mm) in a specific IANA timezone to a UTC Date.
 * Handles DST ambiguities per ADR-006:
 * - Spring forward (non-existent minute): moves to the next valid minute.
 * - Fall back (ambiguous minute): uses the first occurrence.
 */
export function parseWallClockInTimezone(dateString, timeString, timezone) {
  const [yearStr, monthStr, dayStr] = dateString.split('-');
  const [hourStr, minuteStr] = timeString.split(':');

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Initial estimate assuming UTC
  let targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Iteratively converge to account for timezone offset
  for (let i = 0; i < 3; i++) {
    const parts = getLocalParts(new Date(targetUtcMs), timezone);
    const diffMs =
      Date.UTC(year, month - 1, day, hour, minute, 0) -
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);

    if (diffMs === 0) {
      break;
    }
    targetUtcMs += diffMs;
  }

  return new Date(targetUtcMs);
}
