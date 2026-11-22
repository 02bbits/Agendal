import { t } from "../copy";
import { addDays, formatDay, formatTime } from "./dates";
import type { EntryKind } from "./entries";
import { describeRepeat } from "./repeat";
import type { Task, TimeFormat } from "./types";

export function repeatLabel(task: Task): string {
  if (task.repeat === "never") return "";
  if (task.repeat_rule) {
    const desc = describeRepeat(task);
    if (desc) return desc;
  }
  return t(`repeat.every_${task.repeat}`);
}

export type MetaTone = "plain" | "due" | "late" | "muted";

export interface MetaPart {
  text: string;
  tone: MetaTone;
}

export interface RowMetaOptions {
  today: string;
  timeFormat: TimeFormat;
  nowTime?: string;
  entry?: EntryKind;
}

/**
 * The meta line of a task row (LV §2.4). Date and time are separate layers:
 * the date always shows, a time only adds detail, so clearing a time never
 * empties the line. Without `entry` the row sits in Inbox, a project or
 * Search; with it, in an Upcoming day group.
 */
export function rowMeta(task: Task, opts: RowMetaOptions): MetaPart[] {
  const parts = metaParts(task, new MetaFormat(opts));
  return task.done ? parts.map((p) => ({ ...p, tone: "plain" })) : parts;
}

class MetaFormat {
  constructor(readonly opts: RowMetaOptions) {}

  get today() {
    return this.opts.today;
  }

  day(date: string) {
    return formatDay(date, this.opts.today);
  }

  time(time: string) {
    return formatTime(time, this.opts.timeFormat);
  }

  /** `Due today`, `Due today, 17:00`, `Due Mon 23 Nov`, `Due Mon 23 Nov, 17:00`. */
  dueOn(date: string, time: string | null) {
    if (date === this.today) {
      return time
        ? t("task.due_today_at", { time: this.time(time) })
        : t("task.due_today");
    }
    const day = this.day(date);
    return t("task.due_on", {
      date: time ? `${day}, ${this.time(time)}` : day,
    });
  }

  /** Red once the due time has passed today (LV-E9), else the given tone. */
  dueTone(task: Task, tone: MetaTone): MetaTone {
    const passed =
      task.due_date === this.today &&
      !!task.due_time &&
      !!this.opts.nowTime &&
      this.opts.nowTime >= task.due_time;
    return passed ? "late" : tone;
  }
}

function metaParts(task: Task, f: MetaFormat): MetaPart[] {
  const { start_date: start, due_date: due } = task;
  const entry = f.opts.entry;

  if (!start && !due) return [];
  if (due && due < f.today) return overdueParts(task, f);
  if (start && start === due) return sameDayParts(task, f);
  if (due && (entry === "due" || (!entry && due === f.today)))
    return dueDayParts(task, f);
  if (entry === "start" && !start && task.repeat !== "never" && due)
    return task.due_time ? [plain(f.time(task.due_time))] : [];
  if (start && (entry === "start" || (!entry && start === f.today)))
    return startDayParts(task, f);
  if (start && start < f.today)
    return due ? inProgressParts(task, f) : plannedParts(task, f);
  if (start) return futureStartParts(task, f);
  return [{ text: f.dueOn(due!, task.due_time), tone: "due" }];
}

function plain(text: string): MetaPart {
  return { text, tone: "plain" };
}

/** Overdue: `Due {day}[, HH:MM]` in red. */
function overdueParts(task: Task, f: MetaFormat): MetaPart[] {
  return [{ text: f.dueOn(task.due_date!, task.due_time), tone: "late" }];
}

/** Start and due on one day (Today 1.1–1.4, and a normal card in Upcoming). */
function sameDayParts(task: Task, f: MetaFormat): MetaPart[] {
  const date = task.due_date!;
  const { start_time: startTime, due_time: dueTime } = task;
  const entry = f.opts.entry;

  if (startTime && dueTime) {
    const range = t("task.time_range", {
      start: f.time(startTime),
      end: f.time(dueTime),
    });
    return [{ text: range, tone: f.dueTone(task, "plain") }];
  }
  if (startTime) {
    return [
      plain(t("task.starts_at", { time: f.time(startTime) })),
      plain(f.dueOn(date, null)),
    ];
  }
  if (dueTime) {
    const text =
      entry || date !== f.today
        ? t("task.due_at", { time: f.time(dueTime) })
        : f.dueOn(date, dueTime);
    return [
      { text, tone: f.dueTone(task, entry === "start" ? "plain" : "due") },
    ];
  }
  return [plain(f.day(date))];
}

/** The due day of a task that started earlier, or has no start (1.7, 1.8, 1.10). */
function dueDayParts(task: Task, f: MetaFormat): MetaPart[] {
  const date = task.due_date!;
  const text =
    f.opts.entry && task.due_time
      ? t("task.due_at", { time: f.time(task.due_time) })
      : f.dueOn(date, task.due_time);
  const parts: MetaPart[] = [{ text, tone: f.dueTone(task, "due") }];
  if (task.start_date) {
    parts.push(plain(t("task.started_on", { date: f.day(task.start_date) })));
  }
  return parts;
}

/** The start day: `Start at 09:00` / `Starts today` (1.5, 1.6), or `09:00` in Upcoming. */
function startDayParts(task: Task, f: MetaFormat): MetaPart[] {
  const parts: MetaPart[] = [];
  const inToday = !f.opts.entry;
  if (task.start_time) {
    const time = f.time(task.start_time);
    parts.push(plain(inToday ? t("task.starts_at", { time }) : time));
  } else if (inToday) {
    parts.push(plain(t("task.starts_today")));
  }
  if (task.due_date) parts.push(plain(f.dueOn(task.due_date, task.due_time)));
  return parts;
}

/** Started before today, due later (1.9): `In progress · Due {when}`. */
function inProgressParts(task: Task, f: MetaFormat): MetaPart[] {
  const date = task.due_date!;
  let day = f.day(date);
  if (date === addDays(f.today, 1)) day = day.toLowerCase();
  const when = task.due_time ? `${day}, ${f.time(task.due_time)}` : day;
  return [
    plain(t("task.in_progress")),
    { text: t("task.due_on", { date: when }), tone: "due" },
  ];
}

/** Start-only, start passed (1.11, 1.12): `Planned {day}[ · HH:MM]` in tertiary ink. */
function plannedParts(task: Task, f: MetaFormat): MetaPart[] {
  const parts: MetaPart[] = [
    {
      text: t("task.planned", { date: f.day(task.start_date!) }),
      tone: "muted",
    },
  ];
  if (task.start_time) {
    parts.push({ text: f.time(task.start_time), tone: "muted" });
  }
  return parts;
}

/** Starts after today, seen outside Upcoming (Search, a project). */
function futureStartParts(task: Task, f: MetaFormat): MetaPart[] {
  const parts: MetaPart[] = [plain(f.day(task.start_date!))];
  if (task.start_time) parts.push(plain(f.time(task.start_time)));
  if (task.due_date) parts.push(plain(f.dueOn(task.due_date, task.due_time)));
  return parts;
}
