import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { freezeLayout } from "../../src/ui/domain/frozen";
import { buildInbox } from "../../src/ui/domain/lists";
import type { Task } from "../../src/ui/domain/types";
import { useFrozenOrder } from "../../src/ui/features/lists/useFrozenOrder";
import { task } from "./fixtures";

const TODAY = "2026-11-18";
const TOMORROW = "2026-11-19";
const inbox = (tasks: readonly Task[]) =>
  buildInbox(tasks, TODAY, { completedToday: () => false });

const early = task({
  id: "early",
  title: "Early",
  start_date: TODAY,
  start_time: "08:00",
});
const late = task({
  id: "late",
  title: "Late",
  start_date: TODAY,
  start_time: "17:00",
});

describe("freezeLayout (Spec 01 §5)", () => {
  it("without a snapshot the tasks pass through unchanged", () => {
    const tasks = [early, late];
    const frozen = freezeLayout(tasks, null);
    expect(frozen.layout).toBe(tasks);
    expect(frozen.live(early)).toBe(early);
  });

  it("an edited task keeps its place but is drawn with its new values", () => {
    const edited = { ...late, start_time: "07:00" };
    const frozen = freezeLayout([early, edited], late);

    const order = inbox(frozen.layout).today.map(frozen.live);
    expect(order.map((t) => t.id)).toEqual(["early", "late"]);
    expect(order[1]!.start_time).toBe("07:00");
    expect(inbox([early, edited]).today.map((t) => t.id)).toEqual([
      "late",
      "early",
    ]);
  });

  it("a task moved to tomorrow stays in Today while it is open", () => {
    const moved = { ...early, start_date: TOMORROW, start_time: null };
    const frozen = freezeLayout([moved, late], early);
    expect(inbox(frozen.layout).today.map((t) => t.id)).toEqual([
      "early",
      "late",
    ]);
  });

  it("a snapshot of a deleted task is ignored", () => {
    const frozen = freezeLayout([late], early);
    expect(frozen.layout).toEqual([late]);
  });
});

describe("useFrozenOrder", () => {
  it("snapshots the task when the panel opens and releases it on close", () => {
    const { result, rerender } = renderHook(
      ({ tasks, id }: { tasks: Task[]; id: string | null }) =>
        useFrozenOrder(tasks, id),
      { initialProps: { tasks: [early, late], id: "late" as string | null } },
    );

    const edited = { ...late, start_time: "07:00" };
    rerender({ tasks: [early, edited], id: "late" });
    const frozenOrder = inbox(result.current.layout).today.map((t) => t.id);
    expect(frozenOrder).toEqual(["early", "late"]);
    expect(result.current.live(late)).toBe(edited);

    rerender({ tasks: [early, edited], id: null });
    expect(inbox(result.current.layout).today.map((t) => t.id)).toEqual([
      "late",
      "early",
    ]);
  });

  it("switching to another task re-sorts the first and freezes the second", () => {
    const { result, rerender } = renderHook(
      ({ tasks, id }: { tasks: Task[]; id: string | null }) =>
        useFrozenOrder(tasks, id),
      { initialProps: { tasks: [early, late], id: "late" as string | null } },
    );
    const edited = { ...late, start_time: "07:00" };
    rerender({ tasks: [early, edited], id: "early" });
    expect(inbox(result.current.layout).today.map((t) => t.id)).toEqual([
      "late",
      "early",
    ]);
  });
});
