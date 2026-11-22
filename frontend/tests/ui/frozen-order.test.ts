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
  buildInbox(tasks, TODAY, { completedToday: () => true });
const todayIds = (tasks: readonly Task[]) =>
  inbox(tasks).today.map((t) => t.id);

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
const frozenOn = (...snapshots: Task[]) =>
  new Map(snapshots.map((s) => [s.id, s]));

describe("freezeLayout (Spec 01 §5)", () => {
  it("without snapshots the tasks pass through unchanged", () => {
    const tasks = [early, late];
    const frozen = freezeLayout(tasks, new Map());
    expect(frozen.layout).toBe(tasks);
    expect(frozen.live(early)).toBe(early);
  });

  it("an edited task keeps its place but is drawn with its new values", () => {
    const edited = { ...late, start_time: "07:00" };
    const frozen = freezeLayout([early, edited], frozenOn(late));

    const order = inbox(frozen.layout).today.map(frozen.live);
    expect(order.map((t) => t.id)).toEqual(["early", "late"]);
    expect(order[1]!.start_time).toBe("07:00");
    expect(todayIds([early, edited])).toEqual(["late", "early"]);
  });

  it("a task moved to tomorrow stays in Today", () => {
    const moved = { ...early, start_date: TOMORROW, start_time: null };
    const frozen = freezeLayout([moved, late], frozenOn(early));
    expect(todayIds(frozen.layout)).toEqual(["early", "late"]);
  });

  it("ticking a frozen task done still moves it to Completed", () => {
    const done = { ...early, done: true, done_at: `${TODAY}T09:00:00Z` };
    const frozen = freezeLayout([done, late], frozenOn(early));
    const view = inbox(frozen.layout);
    expect(view.today.map((t) => t.id)).toEqual(["late"]);
    expect(view.completed.map((t) => t.id)).toEqual(["early"]);
  });

  it("a snapshot of a deleted task is ignored", () => {
    const frozen = freezeLayout([late], frozenOn(early));
    expect(frozen.layout).toEqual([late]);
  });
});

describe("useFrozenOrder", () => {
  type Props = { tasks: Task[]; id: string | null };
  const mount = (initialProps: Props) =>
    renderHook(({ tasks, id }: Props) => useFrozenOrder(tasks, id), {
      initialProps,
    });
  const edited = { ...late, start_time: "07:00" };

  it("keeps the place after the panel closes", () => {
    const { result, rerender } = mount({ tasks: [early, late], id: "late" });
    rerender({ tasks: [early, edited], id: "late" });
    expect(todayIds(result.current.layout)).toEqual(["early", "late"]);
    expect(result.current.live(late)).toBe(edited);

    rerender({ tasks: [early, edited], id: null });
    expect(todayIds(result.current.layout)).toEqual(["early", "late"]);
  });

  it("keeps every task opened on the screen, not only the last one", () => {
    const { result, rerender } = mount({ tasks: [early, late], id: "late" });
    rerender({ tasks: [early, edited], id: "early" });
    const earlyLater = { ...early, start_time: "18:00" };
    rerender({ tasks: [earlyLater, edited], id: null });
    expect(todayIds(result.current.layout)).toEqual(["early", "late"]);
  });

  it("leaving the screen (unmount) drops the snapshots, so coming back sorts again", () => {
    const first = mount({ tasks: [early, late], id: "late" });
    first.rerender({ tasks: [early, edited], id: null });
    first.unmount();

    const back = mount({ tasks: [early, edited], id: null });
    expect(todayIds(back.result.current.layout)).toEqual(["late", "early"]);
  });
});
