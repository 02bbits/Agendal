import { describe, expect, it } from "vitest";
import { dayDropPatch, inboxDropPatch } from "../../src/ui/domain/dropPatch";
import { normalizePatch } from "../../src/ui/domain/edit";
import { task } from "./fixtures";

// #178, Spec 02 §3: what a drop into another section or day changes
const TODAY = "2026-11-18";

describe("inboxDropPatch", () => {
  it("No date → Today sets the due date to today", () => {
    expect(inboxDropPatch(task({ title: "T" }), "today", TODAY)).toEqual({
      due_date: TODAY,
    });
  });

  it("Overdue → Today moves the due date to today and keeps the span's length", () => {
    const late = task({
      title: "T",
      start_date: "2026-11-10",
      due_date: "2026-11-15",
      due_time: "17:00",
    });
    expect(inboxDropPatch(late, "today", TODAY)).toEqual({
      start_date: "2026-11-13",
      due_date: TODAY,
    });
    expect(
      inboxDropPatch(
        task({ title: "T", due_date: "2026-11-15" }),
        "today",
        TODAY,
      ),
    ).toEqual({ due_date: TODAY });
  });

  it("Today or Overdue → No date clears both dates", () => {
    expect(
      inboxDropPatch(
        task({ title: "T", start_date: TODAY, start_time: "09:00" }),
        "no_date",
        TODAY,
      ),
    ).toEqual({ start_date: null, due_date: null });
  });

  it("Active task → Completed marks it done", () => {
    expect(
      inboxDropPatch(task({ title: "T", due_date: TODAY, done: false }), "completed", TODAY),
    ).toEqual({ done: true });
    expect(
      inboxDropPatch(task({ title: "T", due_date: TODAY, done: true }), "completed", TODAY),
    ).toBeNull();
  });

  it("Completed task → Today uncompletes it and sets due date", () => {
    expect(
      inboxDropPatch(task({ title: "T", done: true }), "today", TODAY),
    ).toEqual({ done: false, due_date: TODAY });
  });

  it("Completed task → No date uncompletes it and clears dates", () => {
    expect(
      inboxDropPatch(task({ title: "T", done: true, due_date: TODAY }), "no_date", TODAY),
    ).toEqual({ done: false, start_date: null, due_date: null });
  });

  it("means nothing when the task is already there, or for Overdue", () => {
    expect(
      inboxDropPatch(task({ title: "T", due_date: TODAY }), "today", TODAY),
    ).toBeNull();
    expect(inboxDropPatch(task({ title: "T" }), "no_date", TODAY)).toBeNull();
    expect(
      inboxDropPatch(task({ title: "T", due_date: TODAY }), "overdue", TODAY),
    ).toBeNull();
  });
});

describe("dayDropPatch", () => {
  it("moves a start day, and the due day when the start would pass it", () => {
    const span = task({
      title: "T",
      start_date: "2026-11-20",
      due_date: "2026-11-22",
    });
    expect(dayDropPatch(span, "2026-11-20", "2026-11-21")).toEqual({
      start_date: "2026-11-21",
    });
    expect(dayDropPatch(span, "2026-11-20", "2026-11-24")).toEqual({
      start_date: "2026-11-24",
      due_date: "2026-11-26",
    });
  });

  it("moves a same-day task's start and due together", () => {
    const same = task({
      title: "T",
      start_date: "2026-11-20",
      due_date: "2026-11-20",
      start_time: "09:00",
    });
    expect(dayDropPatch(same, "2026-11-20", "2026-11-23")).toEqual({
      start_date: "2026-11-23",
      due_date: "2026-11-23",
    });
  });

  it("moves the due day of a task with no start, and nothing for the same day", () => {
    const due = task({ title: "T", due_date: "2026-11-20", repeat: "weekly" });
    expect(dayDropPatch(due, "2026-11-20", "2026-11-19")).toEqual({
      due_date: "2026-11-19",
    });
    expect(dayDropPatch(due, "2026-11-20", "2026-11-20")).toBeNull();
  });
});

describe("normalizePatch keeps places with their day and project (#178)", () => {
  const placed = task({
    title: "T",
    due_date: TODAY,
    project_id: "p-1",
    day_order: "a1",
    project_order: "a2",
  });

  it("a new day without a new place drops day_order, not project_order", () => {
    expect(normalizePatch(placed, { due_date: "2026-11-19" }, TODAY)).toEqual({
      due_date: "2026-11-19",
      day_order: null,
    });
  });

  it("a new day with a new place keeps it", () => {
    expect(
      normalizePatch(
        placed,
        { due_date: "2026-11-19", day_order: "Zz" },
        TODAY,
      ),
    ).toEqual({ due_date: "2026-11-19", day_order: "Zz" });
  });

  it("another project drops project_order", () => {
    expect(normalizePatch(placed, { project_id: "p-2" }, TODAY)).toEqual({
      project_id: "p-2",
      project_order: null,
    });
  });
});
