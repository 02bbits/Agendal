import { describe, expect, it } from "vitest";
import { formatDay } from "../../src/ui/domain/dates";
import { repeatLabel, rowMeta } from "../../src/ui/domain/rowMeta";
import type { Task } from "../../src/ui/domain/types";
import { task } from "./fixtures";

describe("rowMeta", () => {
  const TODAY_WED_18_NOV = "2026-11-18";

  describe("Must-pass cases (today Wed 18 Nov 2026)", () => {
    it("a same-day task with both times shows one time range on either entry", () => {
      const t = task({
        title: "Same day",
        start_date: "2026-11-20",
        start_time: "10:00",
        due_date: "2026-11-20",
        due_time: "11:00",
      });
      const opts = { today: TODAY_WED_18_NOV, timeFormat: "24h" } as const;
      expect(
        rowMeta(t, { ...opts, entry: "start" }).map((p) => p.text),
      ).toEqual(["10:00 – 11:00"]);
      expect(rowMeta(t, { ...opts, entry: "due" }).map((p) => p.text)).toEqual([
        "10:00 – 11:00",
      ]);
    });

    it("start 15, due 19, 14:00, entry: 'due' → Due 14:00 · Started Sun 15", () => {
      const t = task({
        title: "Task 1",
        start_date: "2026-11-15",
        due_date: "2026-11-19",
        due_time: "14:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        entry: "due",
      });
      const expectedDay15 = formatDay("2026-11-15", TODAY_WED_18_NOV);
      expect(parts).toEqual([
        { text: "Due 14:00", tone: "due" },
        { text: `Started ${expectedDay15}`, tone: "plain" },
      ]);
    });

    it("start 21 09:00, due 23, entry: 'start' → 09:00 · Due Mon 23", () => {
      const t = task({
        title: "Task 2",
        start_date: "2026-11-21",
        due_date: "2026-11-23",
        start_time: "09:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        entry: "start",
      });
      const expectedDay23 = formatDay("2026-11-23", TODAY_WED_18_NOV);
      expect(parts).toEqual([
        { text: "09:00", tone: "plain" },
        { text: `Due ${expectedDay23}`, tone: "plain" },
      ]);
    });

    it("start 16, due 19 14:00, no entry → In progress · Due tomorrow, 14:00", () => {
      const t = task({
        title: "Task 3",
        start_date: "2026-11-16",
        due_date: "2026-11-19",
        due_time: "14:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      expect(parts).toEqual([
        { text: "In progress", tone: "plain" },
        { text: "Due tomorrow, 14:00", tone: "due" },
      ]);
    });

    it("due 16 23:59 → Due Mon 16, 23:59 late", () => {
      const t = task({
        title: "Task 4",
        due_date: "2026-11-16",
        due_time: "23:59",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      const expectedDay16 = formatDay("2026-11-16", TODAY_WED_18_NOV);
      expect(parts).toEqual([
        { text: `Due ${expectedDay16}, 23:59`, tone: "late" },
      ]);
    });

    it("start 20 10:00, due 20 11:00 → 10:00 – 11:00", () => {
      const t = task({
        title: "Task 5",
        start_date: "2026-11-20",
        due_date: "2026-11-20",
        start_time: "10:00",
        due_time: "11:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      expect(parts).toEqual([{ text: "10:00 – 11:00", tone: "plain" }]);
    });

    it("start 15 18:00, no due → Planned Sun 15 · 18:00", () => {
      const t = task({
        title: "Task 6",
        start_date: "2026-11-15",
        start_time: "18:00",
        due_date: null,
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      const expectedDay15 = formatDay("2026-11-15", TODAY_WED_18_NOV);
      expect(parts).toEqual([
        { text: `Planned ${expectedDay15}`, tone: "muted" },
        { text: "18:00", tone: "muted" },
      ]);
    });

    it("start 21 09:30, no due, entry: 'start' → 09:30; no entry → Sat 21 · 09:30", () => {
      const t = task({
        title: "Task 7",
        start_date: "2026-11-21",
        start_time: "09:30",
        due_date: null,
      });
      const withEntry = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        entry: "start",
      });
      expect(withEntry).toEqual([{ text: "09:30", tone: "plain" }]);

      const noEntry = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      const expectedDay21 = formatDay("2026-11-21", TODAY_WED_18_NOV);
      expect(noEntry).toEqual([
        { text: expectedDay21, tone: "plain" },
        { text: "09:30", tone: "plain" },
      ]);
    });
  });

  describe("Table cases and details", () => {
    it("case 1: no dates → []", () => {
      const t = task({ title: "No dates" });
      expect(
        rowMeta(t, { today: TODAY_WED_18_NOV, timeFormat: "24h" }),
      ).toEqual([]);
    });

    it("case 2: open, due_date < today without time → Due {day} late", () => {
      const t = task({ title: "Overdue", due_date: "2026-11-16" });
      const expectedDay16 = formatDay("2026-11-16", TODAY_WED_18_NOV);
      expect(
        rowMeta(t, { today: TODAY_WED_18_NOV, timeFormat: "24h" }),
      ).toEqual([{ text: `Due ${expectedDay16}`, tone: "late" }]);
    });

    it("case 3: start_date === due_date with no times in future keeps its day", () => {
      const t = task({
        title: "Same day untimed",
        start_date: "2026-11-20",
        due_date: "2026-11-20",
      });
      expect(
        rowMeta(t, { today: TODAY_WED_18_NOV, timeFormat: "24h" }),
      ).toEqual([
        { text: formatDay("2026-11-20", TODAY_WED_18_NOV), tone: "plain" },
      ]);
    });

    it("case 3: start_date === due_date === today with no times → Today", () => {
      const t = task({
        title: "Same day today untimed",
        start_date: TODAY_WED_18_NOV,
        due_date: TODAY_WED_18_NOV,
      });
      expect(
        rowMeta(t, { today: TODAY_WED_18_NOV, timeFormat: "24h" }),
      ).toEqual([{ text: "Today", tone: "plain" }]);
    });

    it("case 3: start_date === due_date with start_time and no due_time → Start at {time} · Due {day}", () => {
      const t = task({
        title: "Start at 17:00 without due time",
        start_date: "2026-11-20",
        due_date: "2026-11-20",
        start_time: "17:00",
      });
      expect(
        rowMeta(t, { today: TODAY_WED_18_NOV, timeFormat: "24h" }),
      ).toEqual([
        { text: "Start at 17:00", tone: "plain" },
        {
          text: `Due ${formatDay("2026-11-20", TODAY_WED_18_NOV)}`,
          tone: "plain",
        },
      ]);
    });

    it("case 4: due_date === today with due_time and nowTime >= due_time has late tone", () => {
      const t = task({
        title: "Due today passed",
        due_date: TODAY_WED_18_NOV,
        due_time: "10:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        nowTime: "11:00",
      });
      expect(parts).toEqual([{ text: "Due today, 10:00", tone: "late" }]);
    });

    it("case 4: due_date === today with due_time and nowTime < due_time has due tone", () => {
      const t = task({
        title: "Due today future",
        due_date: TODAY_WED_18_NOV,
        due_time: "14:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        nowTime: "11:00",
      });
      expect(parts).toEqual([{ text: "Due today, 14:00", tone: "due" }]);
    });

    it("case 5: start_date === today without entry", () => {
      const t = task({
        title: "Starts today",
        start_date: TODAY_WED_18_NOV,
        start_time: "08:30",
        due_date: "2026-11-22",
        due_time: "17:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      const expectedDay22 = formatDay("2026-11-22", TODAY_WED_18_NOV);
      expect(parts).toEqual([
        { text: "Start at 08:30", tone: "plain" },
        { text: `Due ${expectedDay22}, 17:00`, tone: "plain" },
      ]);
    });

    it("case 8: future start_date with due_date", () => {
      const t = task({
        title: "Future span",
        start_date: "2026-11-25",
        start_time: "09:00",
        due_date: "2026-11-28",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      const expectedStart = formatDay("2026-11-25", TODAY_WED_18_NOV);
      const expectedDue = formatDay("2026-11-28", TODAY_WED_18_NOV);
      expect(parts).toEqual([
        { text: expectedStart, tone: "plain" },
        { text: "09:00", tone: "plain" },
        { text: `Due ${expectedDue}`, tone: "plain" },
      ]);
    });

    it("case 9: future due_date only with time", () => {
      const t = task({
        title: "Future due",
        due_date: "2026-11-25",
        due_time: "15:00",
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      const expectedDue = formatDay("2026-11-25", TODAY_WED_18_NOV);
      expect(parts).toEqual([
        { text: `Due ${expectedDue}, 15:00`, tone: "due" },
      ]);
    });

    it("done tasks: same parts, every tone plain (never late or muted)", () => {
      const tLate = task({
        title: "Done overdue",
        due_date: "2026-11-16",
        due_time: "12:00",
        done: true,
      });
      const partsLate = rowMeta(tLate, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      expect(partsLate[0]?.tone).toBe("plain");

      const tMuted = task({
        title: "Done planned",
        start_date: "2026-11-15",
        start_time: "18:00",
        done: true,
      });
      const partsMuted = rowMeta(tMuted, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
      });
      expect(partsMuted.every((p) => p.tone === "plain")).toBe(true);

      const tDueToday = task({
        title: "Done due today",
        due_date: TODAY_WED_18_NOV,
        due_time: "10:00",
        done: true,
      });
      const partsDueToday = rowMeta(tDueToday, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        nowTime: "12:00",
      });
      expect(partsDueToday[0]?.tone).toBe("plain");
    });

    it("T-TK-119 (TK-E19): the due label turns red when the due time has passed today", () => {
      const t = task({
        title: "Past due time today",
        due_date: TODAY_WED_18_NOV,
        due_time: "10:00",
        done: false,
      });
      const parts = rowMeta(t, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        nowTime: "12:00",
      });
      expect(parts[0]?.tone).toBe("late");
    });

    it("case 4b: repeating task with no start_date on Scheduled (entry: start)", () => {
      const tTimed = task({
        title: "Repeating due only timed",
        start_date: null,
        due_date: "2026-11-20",
        due_time: "17:00",
        repeat: "weekly",
      });
      const partsTimed = rowMeta(tTimed, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        entry: "start",
      });
      expect(partsTimed).toEqual([{ text: "17:00", tone: "plain" }]);
      expect(partsTimed.some((p) => p.text.includes("Due"))).toBe(false);

      const tUntimed = task({
        title: "Repeating due only untimed",
        start_date: null,
        due_date: "2026-11-20",
        repeat: "weekly",
      });
      const partsUntimed = rowMeta(tUntimed, {
        today: TODAY_WED_18_NOV,
        timeFormat: "24h",
        entry: "start",
      });
      expect(partsUntimed).toEqual([]);
    });

    it("repeatLabel generates correct text", () => {
      expect(repeatLabel(task({ title: "T", repeat: "daily" }))).toBe(
        "Every day",
      );
      expect(repeatLabel(task({ title: "T", repeat: "weekly" }))).toBe(
        "Every week",
      );
      expect(repeatLabel(task({ title: "T", repeat: "monthly" }))).toBe(
        "Every month",
      );
      expect(repeatLabel(task({ title: "T", repeat: "yearly" }))).toBe(
        "Every year",
      );
      expect(
        repeatLabel(
          task({
            title: "T",
            repeat: "weekly",
            repeat_rule: "FREQ=WEEKLY;BYDAY=MO",
          }),
        ),
      ).toBe("weekly on Monday, forever");
    });
  });
});

describe("rowMeta: Today card matrix 1.1–1.12 (today Wed 18 Nov 2026)", () => {
  const TODAY = "2026-11-18";
  const opts = { today: TODAY, timeFormat: "24h", nowTime: "07:00" } as const;
  const meta = (fields: Partial<Task>) =>
    rowMeta(task({ title: "T", ...fields }), opts);
  const same = { start_date: TODAY, due_date: TODAY };

  it.each([
    [
      "1.1 same day, both times",
      { ...same, start_time: "08:30", due_time: "10:00" },
      [{ text: "08:30 – 10:00", tone: "plain" }],
    ],
    [
      "1.2 same day, start time only",
      { ...same, start_time: "08:30" },
      [
        { text: "Start at 08:30", tone: "plain" },
        { text: "Due today", tone: "plain" },
      ],
    ],
    [
      "1.3 same day, due time only",
      { ...same, due_time: "17:00" },
      [{ text: "Due today, 17:00", tone: "due" }],
    ],
    ["1.4 same day, no time", same, [{ text: "Today", tone: "plain" }]],
    [
      "1.5 starts today with start time, no due",
      { start_date: TODAY, start_time: "09:00" },
      [{ text: "Start at 09:00", tone: "plain" }],
    ],
    [
      "1.6 starts today, no time, no due",
      { start_date: TODAY },
      [{ text: "Starts today", tone: "plain" }],
    ],
    [
      "1.7 due today with due time",
      { due_date: TODAY, due_time: "18:00" },
      [{ text: "Due today, 18:00", tone: "due" }],
    ],
    [
      "1.8 due today, no time",
      { due_date: TODAY },
      [{ text: "Due today", tone: "due" }],
    ],
    [
      "1.9 in progress, due later",
      { start_date: "2026-11-16", due_date: "2026-11-26" },
      [
        { text: "In progress", tone: "plain" },
        { text: `Due ${formatDay("2026-11-26", TODAY)}`, tone: "due" },
      ],
    ],
    [
      "1.10 started earlier, due today at 16:00",
      { start_date: "2026-11-16", due_date: TODAY, due_time: "16:00" },
      [
        { text: "Due today, 16:00", tone: "due" },
        { text: `Started ${formatDay("2026-11-16", TODAY)}`, tone: "plain" },
      ],
    ],
    [
      "1.11 planned with start time",
      { start_date: "2026-11-16", start_time: "09:00" },
      [
        { text: `Planned ${formatDay("2026-11-16", TODAY)}`, tone: "muted" },
        { text: "09:00", tone: "muted" },
      ],
    ],
    [
      "1.12 planned, no time",
      { start_date: "2026-11-16" },
      [{ text: `Planned ${formatDay("2026-11-16", TODAY)}`, tone: "muted" }],
    ],
  ] as const)("%s", (_name, fields, expected) => {
    expect(meta(fields)).toEqual(expected);
  });

  it("a same-day range turns red once its due time has passed (LV-E9)", () => {
    const parts = rowMeta(
      task({ title: "T", ...same, start_time: "08:30", due_time: "10:00" }),
      { ...opts, nowTime: "10:30" },
    );
    expect(parts).toEqual([{ text: "08:30 – 10:00", tone: "late" }]);
  });

  it("clearing both times keeps the dates on the card", () => {
    const timed = { start_time: "08:30", due_time: "10:00" };
    for (const dates of [
      same,
      { due_date: TODAY },
      { start_date: "2026-11-20", due_date: "2026-11-20" },
      { due_date: "2026-11-20" },
    ]) {
      expect(meta({ ...dates, ...timed }).length).toBeGreaterThan(0);
      expect(meta(dates).length).toBeGreaterThan(0);
    }
  });

  it("an Upcoming due entry without a due time still says when it is due", () => {
    const parts = rowMeta(
      task({ title: "T", start_date: "2026-11-16", due_date: "2026-11-20" }),
      { ...opts, entry: "due" },
    );
    expect(parts[0]).toEqual({
      text: `Due ${formatDay("2026-11-20", TODAY)}`,
      tone: "due",
    });
  });

  it("an Upcoming same-day entry without times keeps its day", () => {
    const parts = rowMeta(
      task({ title: "T", start_date: "2026-11-20", due_date: "2026-11-20" }),
      { ...opts, entry: "start" },
    );
    expect(parts).toEqual([
      { text: formatDay("2026-11-20", TODAY), tone: "plain" },
    ]);
  });
});
