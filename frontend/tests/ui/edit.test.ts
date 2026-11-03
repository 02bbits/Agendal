import { describe, expect, it } from "vitest";
import {
  NOTES_MAX,
  TITLE_MAX,
  localDateTime,
  normalizePatch,
  patchErrors,
  reminderAt,
  reminderPast,
  startAfterDue,
} from "../../src/ui/domain/edit";
import type { Task } from "../../src/ui/domain/types";
import { task } from "./fixtures";

const TODAY = "2026-10-31";

describe("normalizePatch (TK §2.2)", () => {
  const base = task({
    title: "Base",
    start_date: null,
    due_date: null,
    start_time: null,
    due_time: null,
  });

  it("sets the start date to today when a start time is set without dates (rule a)", () => {
    expect(normalizePatch(base, { start_time: "09:00" }, TODAY)).toEqual({
      start_time: "09:00",
      start_date: TODAY,
    });
  });

  it("sets the start date to the due date when a start time is set with a due date (rule a)", () => {
    const withDue = task({
      title: "Task with due",
      start_date: null,
      due_date: "2026-11-05",
    });
    expect(normalizePatch(withDue, { start_time: "09:00" }, TODAY)).toEqual({
      start_time: "09:00",
      start_date: "2026-11-05",
    });
  });

  it("sets the due date to today when a due time is set without one (rule b)", () => {
    expect(normalizePatch(base, { due_time: "10:00" }, TODAY)).toEqual({
      due_time: "10:00",
      due_date: TODAY,
    });
  });

  it("sets the due date to today when repeat is set without either date (rule c)", () => {
    expect(normalizePatch(base, { repeat: "weekly" }, TODAY)).toEqual({
      repeat: "weekly",
      due_date: TODAY,
    });
  });

  it("does not set due date to today when repeat is set to never without dates (rule c)", () => {
    expect(normalizePatch(base, { repeat: "never" }, TODAY)).toEqual({});
  });

  it("does not set due date when repeat is set and start date is present (rule c)", () => {
    const withStart = task({
      title: "Task with start",
      start_date: "2026-11-05",
      due_date: null,
    });
    expect(normalizePatch(withStart, { repeat: "weekly" }, TODAY)).toEqual({
      repeat: "weekly",
    });
  });

  it("clearing the start date clears start_time, and keeps reminder/repeat when due date is present (rule d)", () => {
    const timed = task({
      title: "Task with schedule",
      start_date: "2026-10-30",
      due_date: TODAY,
      start_time: "09:00",
      reminder: "15m",
      repeat: "weekly",
    });
    expect(normalizePatch(timed, { start_date: null }, TODAY)).toEqual({
      start_date: null,
      start_time: null,
    });
  });

  it("clearing the start date clears start_time, reminder and repeat when no due date (rule d)", () => {
    const startOnly = task({
      title: "Task with start only",
      start_date: TODAY,
      due_date: null,
      start_time: "09:00",
      reminder: "15m",
      repeat: "weekly",
    });
    expect(normalizePatch(startOnly, { start_date: null }, TODAY)).toEqual({
      start_date: null,
      start_time: null,
      reminder: "none",
      repeat: "never",
    });
  });

  it("clearing the due date clears due_time, and keeps reminder/repeat when start date is present (rule e)", () => {
    const full = task({
      title: "Full Task",
      start_date: TODAY,
      due_date: "2026-11-05",
      due_time: "10:00",
      reminder: "15m",
      repeat: "weekly",
    });
    expect(normalizePatch(full, { due_date: null }, TODAY)).toEqual({
      due_date: null,
      due_time: null,
    });
  });

  it("clearing the due date clears due_time, reminder and repeat when no start date (rule e)", () => {
    const dueOnly = task({
      title: "Task with due only",
      start_date: null,
      due_date: TODAY,
      due_time: "10:00",
      reminder: "15m",
      repeat: "weekly",
    });
    expect(normalizePatch(dueOnly, { due_date: null }, TODAY)).toEqual({
      due_date: null,
      due_time: null,
      reminder: "none",
      repeat: "never",
    });
  });

  it("allows due time to be cleared while start time remains (TK-E9)", () => {
    const timed = task({
      title: "Task with schedule",
      start_date: TODAY,
      due_date: TODAY,
      start_time: "09:00",
      due_time: "10:00",
    });
    expect(normalizePatch(timed, { due_time: null }, TODAY)).toEqual({
      due_time: null,
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

describe("startAfterDue (TK-3, BR-11)", () => {
  it("exports named constants", () => {
    expect(TITLE_MAX).toBe(200);
    expect(NOTES_MAX).toBe(5000);
  });

  it("returns start_date when start_date is after due_date", () => {
    expect(
      startAfterDue({
        start_date: "2026-11-02",
        due_date: "2026-11-01",
        start_time: null,
        due_time: null,
      }),
    ).toBe("start_date");
  });

  it("returns start_time when dates are equal and start_time is after due_time", () => {
    expect(
      startAfterDue({
        start_date: "2026-11-01",
        due_date: "2026-11-01",
        start_time: "10:00",
        due_time: "09:00",
      }),
    ).toBe("start_time");
  });

  it("returns start_time when dates are equal and start_time equals due_time", () => {
    expect(
      startAfterDue({
        start_date: "2026-11-01",
        due_date: "2026-11-01",
        start_time: "10:00",
        due_time: "10:00",
      }),
    ).toBe("start_time");
  });

  it("returns null for valid schedule cases", () => {
    expect(
      startAfterDue({
        start_date: "2026-11-01",
        due_date: "2026-11-02",
        start_time: "14:00",
        due_time: "09:00",
      }),
    ).toBeNull();
    expect(
      startAfterDue({
        start_date: "2026-11-01",
        due_date: "2026-11-01",
        start_time: "09:00",
        due_time: "10:00",
      }),
    ).toBeNull();
    expect(
      startAfterDue({
        start_date: "2026-11-01",
        due_date: null,
        start_time: "10:00",
        due_time: null,
      }),
    ).toBeNull();
    expect(
      startAfterDue({
        start_date: null,
        due_date: "2026-11-01",
        start_time: null,
        due_time: "10:00",
      }),
    ).toBeNull();
    expect(
      startAfterDue({
        start_date: null,
        due_date: null,
        start_time: null,
        due_time: null,
      }),
    ).toBeNull();
    expect(
      startAfterDue({
        start_date: "2026-11-01",
        due_date: "2026-11-01",
        start_time: "09:00",
        due_time: null,
      }),
    ).toBeNull();
  });
});

describe("patchErrors", () => {
  const base = task({
    title: "Clean task",
    start_date: TODAY,
    due_date: TODAY,
  });

  it("returns task.title_required when title is empty", () => {
    expect(patchErrors(base, { title: "" })).toEqual({
      title: "task.title_required",
    });
    expect(patchErrors(base, { title: "Valid Title" })).toEqual({});
  });

  it("does not return task.title_required when title exceeds TITLE_MAX (enforced by input maxLength)", () => {
    expect(patchErrors(base, { title: "a".repeat(TITLE_MAX + 1) })).toEqual({});
  });

  it("validates schedule via startAfterDue", () => {
    expect(
      patchErrors(base, { start_time: "14:00", due_time: "13:00" }),
    ).toEqual({
      start_time: "task.start_after_due",
    });
    expect(
      patchErrors(base, { start_time: "14:00", due_time: "14:00" }),
    ).toEqual({
      start_time: "task.start_after_due",
    });
    expect(
      patchErrors(base, { start_time: "14:00", due_time: "15:00" }),
    ).toEqual({});
    expect(
      patchErrors(base, {
        start_date: "2026-11-02",
        due_date: "2026-11-01",
      }),
    ).toEqual({
      start_date: "task.start_after_due",
    });
  });

  it("returns task.reminder_needs_date when reminder is set without any date", () => {
    const noDate = task({
      title: "No Date",
      start_date: null,
      due_date: null,
      reminder: "none",
    });
    expect(patchErrors(noDate, { reminder: "15m" })).toEqual({
      reminder: "task.reminder_needs_date",
    });
    expect(
      patchErrors(noDate, { reminder: "15m", due_date: "2026-11-01" }),
    ).toEqual({});
    expect(
      patchErrors(noDate, { reminder: "15m", start_date: "2026-11-01" }),
    ).toEqual({});
  });

  it("allows reminder with only a start date", () => {
    const startOnly = task({
      title: "Start Only",
      start_date: "2026-11-01",
      due_date: null,
      reminder: "none",
    });
    expect(patchErrors(startOnly, { reminder: "30m" })).toEqual({});
  });
});

describe("reminderAt and reminderPast (BR-12, TK-E4)", () => {
  it("calculates fire time offset from start date and start time", () => {
    expect(
      reminderAt({
        start_date: "2026-10-31",
        start_time: "16:00",
        due_date: null,
        due_time: null,
        reminder: "15m",
      }),
    ).toBe("2026-10-31T15:45");
  });

  it("calculates fire time offset from start date defaulting to 09:00 when start time is null", () => {
    expect(
      reminderAt({
        start_date: "2026-10-31",
        start_time: null,
        due_date: null,
        due_time: null,
        reminder: "1h",
      }),
    ).toBe("2026-10-31T08:00");
  });

  it("calculates fire time offset from start time on due date when start_date is set", () => {
    expect(
      reminderAt({
        start_date: "2026-10-31",
        start_time: "16:00",
        due_date: "2026-10-31",
        due_time: "17:00",
        reminder: "15m",
      }),
    ).toBe("2026-10-31T15:45");
    expect(
      reminderAt({
        start_date: "2026-10-31",
        start_time: "09:00",
        due_date: "2026-10-31",
        due_time: null,
        reminder: "1h",
      }),
    ).toBe("2026-10-31T08:00");
  });

  it("calculates fire time offset from due date when start_date is null", () => {
    expect(
      reminderAt({
        start_date: null,
        start_time: null,
        due_date: "2026-10-31",
        due_time: "14:00",
        reminder: "1h",
      }),
    ).toBe("2026-10-31T13:00");
    expect(
      reminderAt({
        start_date: null,
        start_time: null,
        due_date: "2026-10-31",
        due_time: null,
        reminder: "30m",
      }),
    ).toBe("2026-10-31T08:30");
  });

  it("rolls back to previous day when offset crosses midnight", () => {
    expect(
      reminderAt({
        start_date: "2026-10-31",
        start_time: "00:10",
        due_date: null,
        due_time: null,
        reminder: "1d",
      }),
    ).toBe("2026-10-30T00:10");
  });

  it("returns null when reminder is none or both dates are null", () => {
    expect(
      reminderAt({
        start_date: "2026-10-31",
        start_time: "10:00",
        due_date: null,
        due_time: null,
        reminder: "none",
      }),
    ).toBeNull();
    expect(
      reminderAt({
        start_date: null,
        start_time: "10:00",
        due_date: null,
        due_time: null,
        reminder: "15m",
      }),
    ).toBeNull();
  });

  it("checks if reminder has already passed in the given timezone", () => {
    const t: Pick<
      Task,
      "start_date" | "start_time" | "due_date" | "due_time" | "reminder"
    > = {
      start_date: "2026-10-31",
      start_time: "10:00",
      due_date: null,
      due_time: null,
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

    // No date is never past
    expect(
      reminderPast({ ...t, start_date: null, due_date: null }, after, "UTC"),
    ).toBe(false);
  });
});

describe("localDateTime", () => {
  it("formats instant into local date and time in the given time zone", () => {
    expect(localDateTime("2026-10-22T18:30:00Z", "Asia/Ho_Chi_Minh")).toEqual({
      date: "2026-10-23",
      time: "01:30",
    });

    expect(
      localDateTime("2026-10-22T18:30:00Z", "America/Los_Angeles"),
    ).toEqual({
      date: "2026-10-22",
      time: "11:30",
    });
  });
});
