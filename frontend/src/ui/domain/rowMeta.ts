import { t } from "../copy";
import { addDays, formatDay, formatTime, formatTimeRange } from "./dates";
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

export function rowMeta(
  task: Task,
  opts: {
    today: string;
    timeFormat: TimeFormat;
    nowTime?: string;
    entry?: EntryKind;
  },
): MetaPart[] {
  const day = (d: string) => formatDay(d, opts.today);
  const time = (tm: string) => formatTime(tm, opts.timeFormat);

  const getParts = (): MetaPart[] => {
    // 1. No dates
    if (!task.start_date && !task.due_date) {
      return [];
    }

    // 2. Open, due_date < today
    if (task.due_date && task.due_date < opts.today) {
      const dayStr = day(task.due_date);
      const text = task.due_time
        ? t("task.due_on", { date: `${dayStr}, ${time(task.due_time)}` })
        : t("task.due_on", { date: dayStr });
      return [{ text, tone: task.done ? "plain" : "late" }];
    }

    // 3. start_date === due_date
    if (task.start_date && task.due_date && task.start_date === task.due_date) {
      const parts: MetaPart[] = [];
      if (task.start_time) {
        parts.push({
          text: formatTimeRange(
            task.start_time,
            task.due_time,
            opts.timeFormat,
          ),
          tone: "plain",
        });
      }
      // A normal card (Scheduled) has no due word
      if (opts.entry !== "start") {
        parts.push({
          text: t("task.due"),
          tone: task.done ? "plain" : "due",
        });
      }
      return parts;
    }

    // 4. entry === "due", or no entry and due_date === today
    if (opts.entry === "due" || (!opts.entry && task.due_date === opts.today)) {
      let tone: MetaTone = "due";
      if (
        task.due_date === opts.today &&
        task.due_time &&
        opts.nowTime &&
        opts.nowTime >= task.due_time
      ) {
        tone = "late";
      }
      if (task.done) {
        tone = "plain";
      }

      const firstText = task.due_time
        ? t("task.due_at", { time: time(task.due_time) })
        : t("task.due");
      const parts: MetaPart[] = [{ text: firstText, tone }];
      if (task.start_date) {
        parts.push({
          text: t("task.started_on", { date: day(task.start_date) }),
          tone: "plain",
        });
      }
      return parts;
    }

    // 4b. Repeating task with no start_date on Scheduled (entry === "start")
    if (
      opts.entry === "start" &&
      !task.start_date &&
      task.repeat !== "never" &&
      task.due_date
    ) {
      if (task.due_time) {
        return [{ text: time(task.due_time), tone: "plain" }];
      }
      return [];
    }

    // 5. entry === "start", or no entry and start_date === today
    if (
      opts.entry === "start" ||
      (!opts.entry && task.start_date === opts.today)
    ) {
      const parts: MetaPart[] = [];
      if (task.start_time) {
        parts.push({
          text: time(task.start_time),
          tone: "plain",
        });
      }
      if (task.due_date) {
        const dayStr = day(task.due_date);
        const text = task.due_time
          ? t("task.due_on", { date: `${dayStr}, ${time(task.due_time)}` })
          : t("task.due_on", { date: dayStr });
        parts.push({
          text,
          tone: "plain",
        });
      }
      return parts;
    }

    // 6. start_date < today and due_date > today
    if (
      task.start_date &&
      task.due_date &&
      task.start_date < opts.today &&
      task.due_date > opts.today
    ) {
      let dayStr = day(task.due_date);
      if (task.due_date === addDays(opts.today, 1)) {
        dayStr = dayStr.toLowerCase();
      }
      const when = task.due_time ? `${dayStr}, ${time(task.due_time)}` : dayStr;
      return [
        { text: t("task.in_progress"), tone: "plain" },
        {
          text: t("task.due_on", { date: when }),
          tone: task.done ? "plain" : "due",
        },
      ];
    }

    // 7. start_date < today and no due_date
    if (task.start_date && task.start_date < opts.today && !task.due_date) {
      const parts: MetaPart[] = [
        {
          text: t("task.planned", { date: day(task.start_date) }),
          tone: task.done ? "plain" : "muted",
        },
      ];
      if (task.start_time) {
        parts.push({
          text: time(task.start_time),
          tone: task.done ? "plain" : "muted",
        });
      }
      return parts;
    }

    // 8. Future start_date
    if (task.start_date && task.start_date > opts.today) {
      const parts: MetaPart[] = [
        {
          text: day(task.start_date),
          tone: "plain",
        },
      ];
      if (task.start_time) {
        parts.push({
          text: time(task.start_time),
          tone: "plain",
        });
      }
      if (task.due_date) {
        const dayStr = day(task.due_date);
        const text = task.due_time
          ? t("task.due_on", { date: `${dayStr}, ${time(task.due_time)}` })
          : t("task.due_on", { date: dayStr });
        parts.push({
          text,
          tone: "plain",
        });
      }
      return parts;
    }

    // 9. Future due_date only
    if (task.due_date && task.due_date > opts.today) {
      const dayStr = day(task.due_date);
      const text = task.due_time
        ? t("task.due_on", { date: `${dayStr}, ${time(task.due_time)}` })
        : t("task.due_on", { date: dayStr });
      return [
        {
          text,
          tone: task.done ? "plain" : "due",
        },
      ];
    }

    return [];
  };

  const parts = getParts();
  if (task.done) {
    return parts.map((p) => ({ ...p, tone: "plain" as const }));
  }
  return parts;
}
