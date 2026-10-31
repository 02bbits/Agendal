import { describe, expect, it } from "vitest";
import {
  NOTES_MAX,
  TITLE_MAX,
  normalizePatch,
  patchErrors,
  reminderAt,
  reminderPast,
  scheduleError,
} from "../../src/ui/domain/edit";
import type { Task } from "../../src/ui/domain/types";
import { task } from "./fixtures";

const TODAY = "2026-10-31";

describe("normalizePatch (TK §2.2)", () => {
  const base = task({
    title: "Base",
    due_date: null,
    start_time: null,
    end_time: null,
  });

  it("sets the due date to today when a start time is set without one", () => {
    expect(normalizePatch(base, { start_time: "09:00" }, TODAY)).toEqual({
      start_time: "09:00",
      due_date: TODAY,
    });
  });

  it("sets the due date to today when repeat is set without one", () => {
    expect(normalizePatch(base, { repeat: "weekly" }, TODAY)).toEqual({
      repeat: "weekly",
      due_date: TODAY,
    });
  });

  it("does not set due date to today when repeat is set to never without one", () => {
    expect(normalizePatch(base, { repeat: "never" }, TODAY)).toEqual({});
  });

  it("clearing the start clears the end", () => {
    const timed = task({
      title: "Task with schedule",
      due_date: TODAY,
      start_time: "09:00",
      end_time: "10:00",
    });
    expect(normalizePatch(timed, { start_time: null }, TODAY)).toEqual({
      start_time: null,
      end_time: null,
    });
  });

  it("allows end time to be cleared while start time remains (TK-E9)", () => {
    const timed = task({
      title: "Task with schedule",
      due_date: TODAY,
      start_time: "09:00",
      end_time: "10:00",
    });
    expect(normalizePatch(timed, { end_time: null }, TODAY)).toEqual({
      end_time: null,
    });
  });

  it("clearing the due date clears start, end and reminder", () => {
    const full = task({
      title: "Full Task",
      due_date: TODAY,
      start_time: "09:00",
      end_time: "10:00",
      reminder: "15m",
    });
    expect(normalizePatch(full, { due_date: null }, TODAY)).toEqual({
      due_date: null,
      start_time: null,
      end_time: null,
      reminder: "none",
    });
  });

  it("drops unchanged values so no empty patch is sent (TK-E16)", () => {
    const t = task({
      title: "Same Title",
      notes: "Existing notes",
      priority: "medium",
    });
    expect(normalizePatch(t, { title: "Same Title" }, TODAY)).toEqual({});
    expect(normalizePatch(t, { title: "  Same Title  " }, TODAY)).toEqual({});
    expect(normalizePatch(t, { priority: "medium" }, TODAY)).toEqual({});
  });

  it("trims title and notes, normalizing empty notes to null", () => {
    const t = task({ title: "My Task", notes: "Old notes" });
    expect(normalizePatch(t, { title: "  Trimmed Title  " }, TODAY)).toEqual({
      title: "Trimmed Title",
    });
    expect(normalizePatch(t, { notes: "   " }, TODAY)).toEqual({
      notes: null,
    });
    expect(normalizePatch(t, { notes: " New Notes " }, TODAY)).toEqual({
      notes: " New Notes ",
    });
  });
});

describe("scheduleError (TK-3)", () => {
  it("exports named constants", () => {
    expect(TITLE_MAX).toBe(200);
    expect(NOTES_MAX).toBe(5000);
  });

  it("returns task.end_before_start when end is earlier than start", () => {
    expect(scheduleError("10:00", "09:00")).toBe("task.end_before_start");
  });

  it("returns task.end_before_start when end equals start", () => {
    expect(scheduleError("10:00", "10:00")).toBe("task.end_before_start");
  });

  it("returns null when end is later than start", () => {
    expect(scheduleError("09:00", "10:00")).toBeNull();
  });

  it("returns null when either start or end is missing", () => {
    expect(scheduleError("09:00", null)).toBeNull();
    expect(scheduleError(null, "10:00")).toBeNull();
    expect(scheduleError(null, null)).toBeNull();
  });
});

describe("patchErrors", () => {
  const base = task({ title: "Clean task", due_date: TODAY });

  it("returns task.title_required when title is empty or exceeds TITLE_MAX", () => {
    expect(patchErrors(base, { title: "" })).toEqual({
      title: "task.title_required",
    });
    expect(patchErrors(base, { title: "a".repeat(TITLE_MAX + 1) })).toEqual({
      title: "task.title_required",
    });
    expect(patchErrors(base, { title: "Valid Title" })).toEqual({});
  });

  it("validates schedule via scheduleError", () => {
    expect(
      patchErrors(base, { start_time: "14:00", end_time: "13:00" }),
    ).toEqual({
      end_time: "task.end_before_start",
    });
    expect(
      patchErrors(base, { start_time: "14:00", end_time: "14:00" }),
    ).toEqual({
      end_time: "task.end_before_start",
    });
    expect(
      patchErrors(base, { start_time: "14:00", end_time: "15:00" }),
    ).toEqual({});
  });

  it("returns task.reminder_needs_date when reminder is set without a due date", () => {
    const noDate = task({ title: "No Date", due_date: null, reminder: "none" });
    expect(patchErrors(noDate, { reminder: "15m" })).toEqual({
      reminder: "task.reminder_needs_date",
    });
    expect(
      patchErrors(noDate, { reminder: "15m", due_date: "2026-11-01" }),
    ).toEqual({});
  });
});

describe("reminderAt and reminderPast (BR-12, TK-E4)", () => {
  it("calculates fire time offset from start time", () => {
    expect(
      reminderAt({
        due_date: "2026-10-31",
        start_time: "16:00",
        reminder: "15m",
      }),
    ).toBe("2026-10-31T15:45");
    expect(
      reminderAt({
        due_date: "2026-10-31",
        start_time: "09:00",
        reminder: "1h",
      }),
    ).toBe("2026-10-31T08:00");
  });

  it("calculates fire time offset from 09:00 when start time is null", () => {
    expect(
      reminderAt({ due_date: "2026-10-31", start_time: null, reminder: "1h" }),
    ).toBe("2026-10-31T08:00");
    expect(
      reminderAt({ due_date: "2026-10-31", start_time: null, reminder: "30m" }),
    ).toBe("2026-10-31T08:30");
  });

  it("rolls back to previous day when offset crosses midnight", () => {
    expect(
      reminderAt({
        due_date: "2026-10-31",
        start_time: "00:10",
        reminder: "1d",
      }),
    ).toBe("2026-10-30T00:10");
  });

  it("returns null when reminder is none or due_date is null", () => {
    expect(
      reminderAt({
        due_date: "2026-10-31",
        start_time: "10:00",
        reminder: "none",
      }),
    ).toBeNull();
    expect(
      reminderAt({ due_date: null, start_time: "10:00", reminder: "15m" }),
    ).toBeNull();
  });

  it("checks if reminder has already passed in the given timezone", () => {
    const t: Pick<Task, "due_date" | "start_time" | "reminder"> = {
      due_date: "2026-10-31",
      start_time: "10:00",
      reminder: "15m", // fires at 09:45
    };
    // 09:40 UTC in UTC timezone: not passed
    const before = new Date("2026-10-31T09:40:00Z");
    expect(reminderPast(t, before, "UTC")).toBe(false);

    // 09:50 UTC in UTC timezone: passed
    const after = new Date("2026-10-31T09:50:00Z");
    expect(reminderPast(t, after, "UTC")).toBe(true);

    // Reminder none is never past
    expect(reminderPast({ ...t, reminder: "none" }, after, "UTC")).toBe(false);

    // No due date is never past
    expect(reminderPast({ ...t, due_date: null }, after, "UTC")).toBe(false);
  });
});
