import { describe, expect, it } from "vitest";
import {
  manualOrder,
  orderList,
  placeAt,
  rulesKeys,
} from "../../src/ui/domain/order";
import { entriesOf, sortEntries } from "../../src/ui/domain/entries";
import { buildInbox } from "../../src/ui/domain/lists";
import type { Task } from "../../src/ui/domain/types";
import {
  defaultSortMode,
  readSortMode,
  writeSortMode,
} from "../../src/ui/features/lists/useSortMode";
import { task } from "./fixtures";

// #178: manual order with fractional-index keys (Spec 02 §4.1)
const byTitle = (tasks: readonly Task[]) =>
  [...tasks].sort((a, b) => a.title.localeCompare(b.title));
const ids = (tasks: readonly Task[]) => tasks.map((t) => t.id);
const keyed = (id: string, day_order: string | null) =>
  task({ id, title: id.toUpperCase(), day_order });

describe("manualOrder", () => {
  it("places keyed tasks by key, then the rest by the rules", () => {
    const tasks = [
      keyed("c", null),
      keyed("b", "a1"),
      keyed("a", null),
      keyed("d", "a0"),
    ];
    expect(ids(manualOrder(tasks, "day_order", byTitle))).toEqual([
      "d",
      "b",
      "a",
      "c",
    ]);
  });

  it("compares keys by code unit, not by locale (Z before a)", () => {
    const tasks = [keyed("x", "a0"), keyed("y", "Zz")];
    expect(ids(manualOrder(tasks, "day_order", byTitle))).toEqual(["y", "x"]);
  });

  it("two tasks with the same key are ordered by id on every device", () => {
    const tasks = [keyed("q", "a1"), keyed("p", "a1")];
    expect(ids(manualOrder(tasks, "day_order", byTitle))).toEqual(["p", "q"]);
  });

  it("smart mode ignores keys", () => {
    const tasks = [keyed("b", "a0"), keyed("a", "a1")];
    expect(ids(orderList(tasks, "smart", "day_order", byTitle))).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("placeAt", () => {
  const sorted = (tasks: Task[], keys: Map<string, string>) =>
    manualOrder(
      tasks.map((t) => ({ ...t, day_order: keys.get(t.id) ?? t.day_order })),
      "day_order",
      byTitle,
    );

  it("writes only the moved task's key when its neighbours are placed", () => {
    const shown = [keyed("a", "a0"), keyed("b", "a1"), keyed("c", "a2")];
    const keys = placeAt(shown, "c", 1, "day_order");
    expect([...keys.keys()]).toEqual(["c"]);
    expect(ids(sorted(shown, keys))).toEqual(["a", "c", "b"]);
  });

  it("moves to the top and to the bottom", () => {
    const shown = [keyed("a", "a0"), keyed("b", "a1"), keyed("c", "a2")];
    expect(ids(sorted(shown, placeAt(shown, "c", 0, "day_order")))).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(ids(sorted(shown, placeAt(shown, "a", 2, "day_order")))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("a first drag in a list never placed keys only the tasks above the drop point", () => {
    const shown = [keyed("a", null), keyed("b", null), keyed("c", null)];
    const keys = placeAt(shown, "c", 1, "day_order");
    expect([...keys.keys()].sort()).toEqual(["a", "c"]);
    expect(ids(sorted(shown, keys))).toEqual(["a", "c", "b"]);
  });

  it("dropping at the top of a list never placed writes one key", () => {
    const shown = [keyed("a", null), keyed("b", null)];
    const keys = placeAt(shown, "b", 0, "day_order");
    expect([...keys.keys()]).toEqual(["b"]);
    expect(ids(sorted(shown, keys))).toEqual(["b", "a"]);
  });

  it("neighbours with the same key (two devices) place the whole list again", () => {
    const shown = [keyed("a", "a1"), keyed("b", "a1"), keyed("c", "a2")];
    const keys = placeAt(shown, "c", 1, "day_order");
    expect(keys.size).toBe(3);
    expect(ids(sorted(shown, keys))).toEqual(["a", "c", "b"]);
  });

  it("when tasks have disordered keys (e.g. from smart order), places whole list to prevent scrambling", () => {
    // 6 tasks shown in smart order, but carrying old keys that don't match screen order
    const shown = [
      keyed("1", "a5"),
      keyed("2", "a3"),
      keyed("3", "a4"),
      keyed("4", "a0"),
      keyed("5", "a1"),
      keyed("6", "a2"),
    ];
    // Drag task '2' from position 1 down to bottom (position 5)
    const keys = placeAt(shown, "2", 5, "day_order");
    expect(keys.size).toBe(6);
    expect(ids(sorted(shown, keys))).toEqual(["1", "3", "4", "5", "6", "2"]);
  });

  it("an unknown task changes nothing", () => {
    expect(placeAt([keyed("a", "a0")], "zz", 0, "day_order").size).toBe(0);
  });
});

describe("rulesKeys", () => {
  it("gives one increasing key per task, in the given order", () => {
    const shown = [keyed("c", "a5"), keyed("a", null), keyed("b", "a0")];
    const keys = rulesKeys(shown);
    const k = ids(shown).map((id) => keys.get(id)!);
    expect(k[0]! < k[1]! && k[1]! < k[2]!).toBe(true);
  });
});

describe("lists follow their sort mode", () => {
  const TODAY = "2026-11-18";
  const early = task({
    id: "early",
    title: "Early",
    start_date: TODAY,
    start_time: "08:00",
    day_order: "a1",
  });
  const late = task({
    id: "late",
    title: "Late",
    start_date: TODAY,
    start_time: "17:00",
    day_order: "a0",
  });
  const inbox = (sort: Parameters<typeof buildInbox>[2]["sort"]) =>
    buildInbox([early, late], TODAY, { completedToday: () => false, sort });

  it("Today is smart by default: keys are ignored", () => {
    expect(ids(inbox(undefined).today)).toEqual(["early", "late"]);
  });

  it("Today in manual mode follows day_order", () => {
    expect(ids(inbox({ today: "manual" }).today)).toEqual(["late", "early"]);
  });

  it("No date is manual by default and follows project_order", () => {
    const a = task({
      id: "a",
      title: "A",
      priority: "high",
      project_order: "a1",
    });
    const b = task({
      id: "b",
      title: "B",
      priority: "low",
      project_order: "a0",
    });
    const view = buildInbox([a, b], TODAY, { completedToday: () => false });
    expect(ids(view.noDate)).toEqual(["b", "a"]);
  });

  it("an Upcoming day orders normal entries by its mode, and due markers always by the rules", () => {
    const day = "2026-11-20";
    const n1 = task({
      id: "n1",
      title: "N1",
      start_date: day,
      start_time: "08:00",
      day_order: "a1",
    });
    const n2 = task({
      id: "n2",
      title: "N2",
      start_date: day,
      start_time: "09:00",
      day_order: "a0",
    });
    const d1 = task({
      id: "d1",
      title: "D1",
      due_date: day,
      due_time: "08:00",
      day_order: "a1",
    });
    const d2 = task({
      id: "d2",
      title: "D2",
      due_date: day,
      due_time: "09:00",
      day_order: "a0",
    });
    const entries = [n1, n2, d1, d2].flatMap(entriesOf);
    const manual = sortEntries(entries, "manual");
    expect(manual.normal.map((e) => e.task.id)).toEqual(["n2", "n1"]);
    expect(manual.due.map((e) => e.task.id)).toEqual(["d1", "d2"]);
    expect(sortEntries(entries).normal.map((e) => e.task.id)).toEqual([
      "n1",
      "n2",
    ]);
  });
});

describe("sort modes", () => {
  it("default to smart for Today and Upcoming, manual for No date and projects", () => {
    expect(defaultSortMode("today")).toBe("smart");
    expect(defaultSortMode("upcoming")).toBe("smart");
    expect(defaultSortMode("no_date")).toBe("manual");
    expect(defaultSortMode("project:p-1")).toBe("manual");
  });

  it("are remembered per list on this device", () => {
    localStorage.clear();
    writeSortMode("today", "manual");
    expect(readSortMode("today")).toBe("manual");
    expect(readSortMode("upcoming")).toBe("smart");
  });

  it("a broken stored value falls back to the default", () => {
    localStorage.setItem("agendal.sort_modes", "not json");
    expect(readSortMode("project:p-1")).toBe("manual");
  });
});
