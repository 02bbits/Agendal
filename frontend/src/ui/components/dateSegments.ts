export type Segment = "day" | "month" | "year";

export interface Segments {
  day: string;
  month: string;
  year: string;
}

export interface SegmentDisplay {
  text: string;
  placeholder: string;
  placeholderKey?:
    "date.placeholder_day" | "date.placeholder_month" | "date.placeholder_year";
}

export function fromIso(iso: string | null): Segments {
  if (!iso) {
    return { day: "", month: "", year: "" };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return { day: "", month: "", year: "" };
  }
  return { day: match[3], month: match[2], year: match[1] };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

export function toIso(s: Segments): string | null {
  if (
    !/^\d{2}$/.test(s.day) ||
    !/^\d{2}$/.test(s.month) ||
    !/^\d{4}$/.test(s.year)
  ) {
    return null;
  }
  const y = parseInt(s.year, 10);
  const m = parseInt(s.month, 10);
  const d = parseInt(s.day, 10);
  if (y < 1 || y > 9999 || m < 1 || m > 12) {
    return null;
  }
  const maxD = daysInMonth(y, m);
  if (d < 1 || d > maxD) {
    return null;
  }
  return `${s.year}-${s.month}-${s.day}`;
}

export function typeDigit(
  seg: Segment,
  current: string,
  digit: string,
): { value: string; advance: boolean } {
  if (!/^\d$/.test(digit)) {
    return { value: current, advance: false };
  }
  if (seg === "day") {
    const cur = current.length >= 2 ? "" : current;
    if (cur === "") {
      if (digit >= "4" && digit <= "9") {
        return { value: `0${digit}`, advance: true };
      }
      return { value: digit, advance: false };
    }
    return { value: `${cur}${digit}`, advance: true };
  }
  if (seg === "month") {
    const cur = current.length >= 2 ? "" : current;
    if (cur === "") {
      if (digit >= "2" && digit <= "9") {
        return { value: `0${digit}`, advance: true };
      }
      return { value: digit, advance: false };
    }
    return { value: `${cur}${digit}`, advance: true };
  }
  const cur = current.length >= 4 ? "" : current;
  const next = `${cur}${digit}`;
  return { value: next, advance: next.length === 4 };
}

export function pad(seg: Segment, value: string): string {
  if (seg === "year") return value;
  if (!value) return "";
  if (value.length === 1) return `0${value}`;
  return value;
}

export function step(
  seg: Segment,
  value: string,
  delta: number,
  today?: string | Segments,
): string {
  const todaySegs = typeof today === "string" ? fromIso(today) : today;
  let num: number;
  if (value !== "") {
    num = parseInt(value, 10);
    if (isNaN(num)) num = 0;
  } else {
    const todayVal = todaySegs?.[seg];
    if (todayVal && todayVal !== "") {
      num = parseInt(todayVal, 10);
    } else {
      num = seg === "year" ? 2026 : 1;
    }
  }

  if (seg === "day") {
    let next = num + delta;
    if (next > 31) next = 1;
    if (next < 1) next = 31;
    return String(next).padStart(2, "0");
  }

  if (seg === "month") {
    let next = num + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    return String(next).padStart(2, "0");
  }

  let next = num + delta;
  if (next > 2100) next = 1900;
  if (next < 1900) next = 2100;
  return String(next);
}

export function display(seg: Segment, value: string): SegmentDisplay {
  if (!value) {
    const placeholderKey =
      seg === "day"
        ? "date.placeholder_day"
        : seg === "month"
          ? "date.placeholder_month"
          : "date.placeholder_year";
    const placeholder = seg === "day" ? "dd" : seg === "month" ? "mm" : "yyyy";
    return { text: "", placeholder, placeholderKey };
  }
  if (seg === "year" && value.length < 4) {
    return { text: value, placeholder: "yyyy".slice(value.length) };
  }
  return { text: value, placeholder: "" };
}
