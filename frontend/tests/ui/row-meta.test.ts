import { describe, expect, it } from "vitest";
import { formatDay } from "../../src/ui/domain/dates";
import { rowMeta } from "../../src/ui/domain/rowMeta";
import { task } from "./fixtures";

describe("rowMeta", () => {
  const TODAY_WED_18_NOV = "2026-11-18";

  describe("Must-pass cases (today Wed 18 Nov 2026)", () => {
    it("a same-day task on a normal card has no due word", () => {
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
        "Due",
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

    it("start 20 10:00, due 20 11:00 → 10:00 – 11:00 · Due", () => {
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
      expect(parts).toEqual([
        { text: "10:00 – 11:00", tone: "plain" },
        { text: "Due", tone: "due" },
      ]);
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

    it("case 3: start_date === due_date with no start_time → Due", () => {
      const t = task({
        title: "Same day untimed",
        start_date: "2026-11-20",
        due_date: "2026-11-20",
      });
      expect(
        rowMeta(t, { today: TODAY_WED_18_NOV, timeFormat: "24h" }),
      ).toEqual([{ text: "Due", tone: "due" }]);
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
      expect(parts).toEqual([{ text: "Due 10:00", tone: "late" }]);
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
      expect(parts).toEqual([{ text: "Due 14:00", tone: "due" }]);
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
        { text: "08:30", tone: "plain" },
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
  });
});
