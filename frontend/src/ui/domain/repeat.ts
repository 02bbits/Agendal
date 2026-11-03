import type { Task } from "./types";

export type RepeatLocale = "en" | "vi";
type RepeatingTask = Pick<
  Task,
  "repeat" | "repeat_rule" | "repeat_anchor" | "due_date"
>;

const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const units = {
  en: { daily: "day", weekly: "week", monthly: "month", yearly: "year" },
  vi: { daily: "ngày", weekly: "tuần", monthly: "tháng", yearly: "năm" },
};

function ordinal(value: number, locale: RepeatLocale): string {
  if (locale === "vi") {
    return (
      ["đầu tiên", "thứ hai", "thứ ba", "thứ tư", "thứ năm"][value - 1] ??
      "cuối cùng"
    );
  }
  return ["first", "second", "third", "fourth", "fifth"][value - 1] ?? "last";
}

function dayName(code: string, locale: RepeatLocale): string {
  const date = new Date(Date.UTC(2026, 0, 5 + weekdays.indexOf(code)));
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    weekday: "long",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/^Thứ/, "thứ");
}

function list(values: string[], locale: RepeatLocale): string {
  return new Intl.ListFormat(locale === "vi" ? "vi-VN" : "en-US", {
    type: "conjunction",
  }).format(values);
}

function dateParts(
  value: string | null | undefined,
): { month: number; day: number; weekday: string } | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return;
  return {
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: weekdays[(date.getUTCDay() + 6) % 7],
  };
}

function custom(locale: RepeatLocale): string {
  return locale === "vi" ? "Lịch lặp tùy chỉnh" : "Custom repeat schedule";
}

/** Presentation only: scheduling and rule validation remain on the server. */
export function describeRepeat(
  task: RepeatingTask,
  locale: RepeatLocale = "en",
): string | undefined {
  if (task.repeat === "never") return;
  const rule = task.repeat_rule;
  const parts: Record<string, string> = {};
  if (rule) {
    for (const component of rule.split(";")) {
      const [key, value, extra] = component.split("=");
      if (
        !key ||
        !value ||
        extra !== undefined ||
        key in parts ||
        ![
          "FREQ",
          "INTERVAL",
          "BYDAY",
          "BYMONTHDAY",
          "BYMONTH",
          "WKST",
          "COUNT",
          "UNTIL",
        ].includes(key)
      )
        return custom(locale);
      parts[key] = value;
    }
    if (
      parts.FREQ !== task.repeat.toUpperCase() ||
      (parts.COUNT && parts.UNTIL)
    )
      return custom(locale);
  }
  const interval = Number(parts.INTERVAL ?? 1);
  if (
    (parts.INTERVAL && !/^\d+$/.test(parts.INTERVAL)) ||
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 999 ||
    (parts.WKST && !weekdays.includes(parts.WKST))
  )
    return custom(locale);
  const unit = units[locale][task.repeat];
  let text =
    locale === "vi"
      ? `Mỗi ${interval === 1 ? "" : `${interval} `}${unit}`
      : interval === 1
        ? task.repeat
        : `every ${interval} ${unit}s`;
  const anchor = dateParts(task.repeat_anchor ?? task.due_date);
  let days = parts.BYDAY;
  let monthDays = parts.BYMONTHDAY;
  let months = parts.BYMONTH;
  if (!days && !monthDays && anchor) {
    if (task.repeat === "weekly") days = anchor.weekday;
    if (task.repeat === "monthly" || task.repeat === "yearly")
      monthDays = String(anchor.day);
  }
  if (
    task.repeat === "yearly" &&
    !months &&
    !days &&
    !parts.BYMONTHDAY &&
    anchor
  )
    months = String(anchor.month);
  if (days) {
    const names: string[] = [];
    const selected = [...new Set(days.split(","))];
    if (task.repeat === "weekly") {
      const first = weekdays.indexOf(parts.WKST ?? "MO");
      selected.sort(
        (a, b) =>
          ((weekdays.indexOf(a) - first + 7) % 7) -
          ((weekdays.indexOf(b) - first + 7) % 7),
      );
    }
    for (const day of selected) {
      const match = /^(-1|[1-5])?(MO|TU|WE|TH|FR|SA|SU)$/.exec(day);
      if (
        !match ||
        (match[1] && task.repeat !== "monthly" && task.repeat !== "yearly")
      )
        return custom(locale);
      const name = dayName(match[2], locale);
      names.push(
        match[1]
          ? locale === "vi"
            ? `${name} ${ordinal(Number(match[1]), locale)}`
            : `${ordinal(Number(match[1]), locale)} ${name}`
          : name,
      );
    }
    text +=
      locale === "vi"
        ? ` vào ${list(names, locale)}`
        : ` on ${list(names, locale)}`;
    if (task.repeat === "monthly")
      text += locale === "vi" ? " trong tháng" : " of the month";
  }
  if (monthDays) {
    const values = monthDays.split(",").map(Number);
    if (
      values.some(
        (value) =>
          !Number.isInteger(value) ||
          (value !== -1 && (value < 1 || value > 31)),
      ) ||
      days
    )
      return custom(locale);
    const names = values.map((value) =>
      value === -1
        ? locale === "vi"
          ? "ngày cuối"
          : "the last day"
        : locale === "vi"
          ? `ngày ${value}`
          : `day ${value}`,
    );
    text +=
      locale === "vi"
        ? ` vào ${list(names, locale)}`
        : ` on ${list(names, locale)}`;
    if (task.repeat === "monthly")
      text += locale === "vi" ? " trong tháng" : " of the month";
    if (task.repeat === "monthly" && values.some((day) => day > 28)) {
      text += !rule
        ? locale === "vi"
          ? " (lấy ngày cuối nếu tháng ngắn hơn)"
          : " (last day in shorter months)"
        : locale === "vi"
          ? " (bỏ qua tháng không có ngày này)"
          : " (skipping months without this day)";
    }
  }
  if (months) {
    const values = months.split(",").map(Number);
    if (
      values.some(
        (value) => !Number.isInteger(value) || value < 1 || value > 12,
      )
    )
      return custom(locale);
    const names = values.map((month) =>
      new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        month: "long",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(2026, month - 1, 1))),
    );
    text +=
      locale === "vi"
        ? ` của ${list(names, locale)}`
        : ` in ${list(names, locale)}`;
  }
  if (task.repeat === "yearly" && monthDays === "29" && months === "2") {
    text += !rule
      ? locale === "vi"
        ? " (lấy ngày cuối tháng nếu năm không có ngày này)"
        : " (last day of February in non-leap years)"
      : locale === "vi"
        ? " (chỉ năm nhuận)"
        : " (leap years only)";
  }
  if (parts.COUNT) {
    const count = Number(parts.COUNT);
    if (
      !/^\d+$/.test(parts.COUNT) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10000
    )
      return custom(locale);
    text +=
      locale === "vi"
        ? `, tổng cộng ${count} lần`
        : `, ${count} ${count === 1 ? "time" : "times"}`;
  } else if (parts.UNTIL) {
    const match =
      /^(\d{4})(\d{2})(\d{2})(?:T(?:[01]\d|2[0-3])[0-5]\d[0-5]\dZ)?$/.exec(
        parts.UNTIL,
      );
    const date = match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
    if (!dateParts(date)) return custom(locale);
    text +=
      locale === "vi"
        ? `, đến hết ${match![3]}/${match![2]}/${match![1]}`
        : `, through ${date}`;
  } else if (rule) {
    text += locale === "vi" ? ", không kết thúc" : ", forever";
  }
  return text;
}
