import { describe, expect, it } from "vitest";
import {
  entriesOf,
  matchesEntry,
  sortEntries,
} from "../../src/ui/domain/entries";
import { task } from "./fixtures";

describe("entriesOf", () => {
  it("start and due on different days → a start and a due entry", () => {
    const t = task({
      title: "Span",
      start_date: "2026-10-25",
      due_date: "2026-10-27",
    });
    const entries = entriesOf(t);
    expect(entries).toEqual([
      { task: t, kind: "start", date: "2026-10-25" },
      { task: t, kind: "due", date: "2026-10-27" },
    ]);
  });

  it("same day → ONE due entry", () => {
    const t = task({
      title: "Same day",
      start_date: "2026-10-25",
      due_date: "2026-10-25",
    });
    const entries = entriesOf(t);
    expect(entries).toEqual([{ task: t, kind: "due", date: "2026-10-25" }]);
  });

  it("due only → due", () => {
    const t = task({ title: "Due only", due_date: "2026-10-25" });
    const entries = entriesOf(t);
    expect(entries).toEqual([{ task: t, kind: "due", date: "2026-10-25" }]);
  });

  it("start only → start", () => {
    const t = task({ title: "Start only", start_date: "2026-10-25" });
    const entries = entriesOf(t);
    expect(entries).toEqual([{ task: t, kind: "start", date: "2026-10-25" }]);
  });

  it("no date → []", () => {
    const t = task({ title: "No date" });
    expect(entriesOf(t)).toEqual([]);
  });
});

describe("matchesEntry", () => {
  const spanTask = task({
    title: "Span",
    start_date: "2026-10-25",
    due_date: "2026-10-27",
  });
  const sameDayTask = task({
    title: "Same day",
    start_date: "2026-10-25",
    due_date: "2026-10-25",
  });
  const dueOnlyTask = task({ title: "Due only", due_date: "2026-10-27" });
  const startOnlyTask = task({ title: "Start only", start_date: "2026-10-25" });

  it("all filter matches any entry", () => {
    expect(
      matchesEntry(
        { task: spanTask, kind: "start", date: "2026-10-25" },
        "all",
      ),
    ).toBe(true);
    expect(
      matchesEntry({ task: spanTask, kind: "due", date: "2026-10-27" }, "all"),
    ).toBe(true);
    expect(
      matchesEntry(
        { task: dueOnlyTask, kind: "due", date: "2026-10-27" },
        "all",
      ),
    ).toBe(true);
    expect(
      matchesEntry(
        { task: startOnlyTask, kind: "start", date: "2026-10-25" },
        "all",
      ),
    ).toBe(true);
  });

  it("scheduled filter matches start entries and same-day tasks with start_date", () => {
    expect(
      matchesEntry(
        { task: spanTask, kind: "start", date: "2026-10-25" },
        "scheduled",
      ),
    ).toBe(true);
    expect(
      matchesEntry(
        { task: spanTask, kind: "due", date: "2026-10-27" },
        "scheduled",
      ),
    ).toBe(false);
    expect(
      matchesEntry(
        { task: sameDayTask, kind: "due", date: "2026-10-25" },
        "scheduled",
      ),
    ).toBe(true);
    expect(
      matchesEntry(
        { task: dueOnlyTask, kind: "due", date: "2026-10-27" },
        "scheduled",
      ),
    ).toBe(false);
    expect(
      matchesEntry(
        { task: startOnlyTask, kind: "start", date: "2026-10-25" },
        "scheduled",
      ),
    ).toBe(true);
  });

  it("scheduled filter matches repeating due-only tasks (Part B)", () => {
    const repeatingDueOnlyTask = task({
      title: "Repeating due only",
      due_date: "2026-10-27",
      repeat: "weekly",
    });
    expect(
      matchesEntry(
        { task: repeatingDueOnlyTask, kind: "due", date: "2026-10-27" },
        "scheduled",
      ),
    ).toBe(true);
  });

  it("due filter matches due entries only", () => {
    expect(
      matchesEntry(
        { task: spanTask, kind: "start", date: "2026-10-25" },
        "due",
      ),
    ).toBe(false);
    expect(
      matchesEntry({ task: spanTask, kind: "due", date: "2026-10-27" }, "due"),
    ).toBe(true);
    expect(
      matchesEntry(
        { task: sameDayTask, kind: "due", date: "2026-10-25" },
        "due",
      ),
    ).toBe(true);
    expect(
      matchesEntry(
        { task: dueOnlyTask, kind: "due", date: "2026-10-27" },
        "due",
      ),
    ).toBe(true);
    expect(
      matchesEntry(
        { task: startOnlyTask, kind: "start", date: "2026-10-25" },
        "due",
      ),
    ).toBe(false);
  });
});

describe("sortEntries", () => {
  it("splits entries into normal and due while preserving sortWithinDay order", () => {
    const tTimedStart = task({
      title: "Timed start",
      start_date: "2026-10-25",
      start_time: "09:00",
    });
    const tUntimedStart = task({
      title: "Untimed start",
      start_date: "2026-10-25",
      priority: "high",
    });
    const tTimedDue = task({
      title: "Timed due",
      due_date: "2026-10-25",
      start_time: "10:00",
    });
    const tUntimedDue = task({
      title: "Untimed due",
      due_date: "2026-10-25",
      priority: "medium",
    });

    const entries = [
      { task: tUntimedStart, kind: "start" as const, date: "2026-10-25" },
      { task: tUntimedDue, kind: "due" as const, date: "2026-10-25" },
      { task: tTimedStart, kind: "start" as const, date: "2026-10-25" },
      { task: tTimedDue, kind: "due" as const, date: "2026-10-25" },
    ];

    const result = sortEntries(entries);
    expect(result.normal.map((e) => e.task.title)).toEqual([
      "Timed start",
      "Untimed start",
    ]);
    expect(result.due.map((e) => e.task.title)).toEqual([
      "Timed due",
      "Untimed due",
    ]);
  });
});
