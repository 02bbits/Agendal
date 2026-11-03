import { describe, expect, it } from "vitest";
import {
  defaultProjectColour,
  projectNameError,
  projectNameValid,
  projectProgress,
  sortOpenByDue,
  sortProjects,
} from "../../src/ui/domain/projects";
import type { Project, Task } from "../../src/ui/domain/types";

const testProjects: Project[] = [
  { id: "1", name: "Work", colour: "blue", created_at: "2026-01-01" },
  { id: "2", name: "Personal", colour: "red", created_at: "2026-01-02" },
];

describe("project domain rules", () => {
  it("validates names (PJ-1, PJ-E1, PJ-E8)", () => {
    expect(projectNameValid("")).toBe(false);
    expect(projectNameValid("   ")).toBe(false);
    expect(projectNameValid("Valid Name")).toBe(true);
    expect(projectNameValid("a".repeat(40))).toBe(true);
    expect(projectNameValid("a".repeat(41))).toBe(false);
  });

  it("checks uniqueness ignoring case and trimming (PJ-E1)", () => {
    expect(projectNameError("work", testProjects)).toBe("project.name_taken");
    expect(projectNameError("  Work  ", testProjects)).toBe(
      "project.name_taken",
    );
    expect(projectNameError("work", testProjects, "1")).toBeNull();
    expect(projectNameError("Unique Name", testProjects)).toBeNull();
  });

  it("selects first unused colour (PJ §2.1)", () => {
    // Blue (0) and Red (1) are used in testProjects, next is orange (2)
    expect(defaultProjectColour(testProjects)).toBe("orange");
  });

  it("sorts projects alphabetically case-insensitive (PJ §2.2)", () => {
    const list: Project[] = [
      { id: "1", name: "banana", colour: "yellow", created_at: "2026-01-01" },
      { id: "2", name: "Apple", colour: "red", created_at: "2026-01-01" },
      { id: "3", name: "cherry", colour: "red", created_at: "2026-01-01" },
    ];
    expect(sortProjects(list).map((p) => p.name)).toEqual([
      "Apple",
      "banana",
      "cherry",
    ]);
  });

  it("calculates progress (PJ-2)", () => {
    const tasks: Task[] = [
      {
        id: "t1",
        title: "Task 1",
        project_id: "1",
        done: true,
        done_at: "2026-01-01",
        created_at: "2026-01-01",
        start_date: null,
        due_date: null,
        start_time: null,
        due_time: null,
        priority: "low",
        repeat: "never",
        reminder: "none",
        notes: null,
        created_by: "user",
      },
      {
        id: "t2",
        title: "Task 2",
        project_id: "1",
        done: false,
        done_at: null,
        created_at: "2026-01-01",
        start_date: null,
        due_date: null,
        start_time: null,
        due_time: null,
        priority: "low",
        repeat: "never",
        reminder: "none",
        notes: null,
        created_by: "user",
      },
      {
        id: "t3",
        title: "Task 3",
        project_id: null,
        done: false,
        done_at: null,
        created_at: "2026-01-01",
        start_date: null,
        due_date: null,
        start_time: null,
        due_time: null,
        priority: "low",
        repeat: "never",
        reminder: "none",
        notes: null,
        created_by: "user",
      },
    ];
    expect(projectProgress(tasks, "1")).toEqual({ done: 1, total: 2 });
    expect(projectProgress(tasks, null)).toEqual({ done: 0, total: 1 });
  });

  it("sorts open tasks by due date (no date last), priority, created (PJ §2.3)", () => {
    const tHigh: Task = {
      id: "t-high",
      title: "High",
      project_id: "1",
      done: false,
      done_at: null,
      created_at: "2026-01-02",
      start_date: null,
      due_date: "2026-10-25",
      start_time: null,
      due_time: null,
      priority: "high",
      repeat: "never",
      reminder: "none",
      notes: null,
      created_by: "user",
    };
    const tLow: Task = {
      id: "t-low",
      title: "Low",
      project_id: "1",
      done: false,
      done_at: null,
      created_at: "2026-01-01",
      start_date: null,
      due_date: "2026-10-25",
      start_time: null,
      due_time: null,
      priority: "low",
      repeat: "never",
      reminder: "none",
      notes: null,
      created_by: "user",
    };
    const tNoDate: Task = {
      id: "t-nodate",
      title: "No Date",
      project_id: "1",
      done: false,
      done_at: null,
      created_at: "2026-01-01",
      start_date: null,
      due_date: null,
      start_time: null,
      due_time: null,
      priority: "high",
      repeat: "never",
      reminder: "none",
      notes: null,
      created_by: "user",
    };

    expect(sortOpenByDue([tNoDate, tLow, tHigh]).map((t) => t.id)).toEqual([
      "t-high",
      "t-low",
      "t-nodate",
    ]);
  });
});
