import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { useTaskStore } from "../../src/ui/features/tasks/store";
import type { TaskStore } from "../../src/ui/features/tasks/types";
import { task } from "./fixtures";
import { setup } from "./harness";

// #178: the store writes manual-order keys on screen at once, sends them as one batch, and
// gives back an Undo
const handle: { store?: TaskStore } = {};
function Probe() {
  const store = useTaskStore();
  useEffect(() => {
    handle.store = store;
  });
  return (
    <ul>
      {store.tasks.map((t) => (
        <li key={t.id}>{`${t.id}:${t.day_order ?? "-"}`}</li>
      ))}
    </ul>
  );
}

const a = task({ id: "a", title: "A", day_order: "a0" });
const b = task({ id: "b", title: "B" });

describe("store.reorder (#178)", () => {
  it("shows the keys at once, sends them, and Undo puts the old ones back", async () => {
    const { wrap, memory } = setup([a, b]);
    render(wrap(<Probe />));

    let undo = () => {};
    act(() => {
      undo = handle.store!.reorder(
        new Map([
          ["a", "a5"],
          ["b", "a6"],
        ]),
        "day_order",
      );
    });
    expect(screen.getByText("a:a5")).toBeTruthy();
    expect(screen.getByText("b:a6")).toBeTruthy();
    await waitFor(() =>
      expect(memory.db.tasks.map((t) => t.day_order)).toEqual(["a5", "a6"]),
    );

    act(() => undo());
    expect(screen.getByText("a:a0")).toBeTruthy();
    expect(screen.getByText("b:-")).toBeTruthy();
    await waitFor(() =>
      expect(memory.db.tasks.map((t) => t.day_order ?? null)).toEqual([
        "a0",
        null,
      ]),
    );
  });

  it("a refused batch puts the previous keys back and says so", async () => {
    const { wrap, memory } = setup([a, b]);
    render(wrap(<Probe />));
    memory.fail();

    act(() => {
      handle.store!.reorder(new Map([["b", "Zz"]]), "day_order");
    });
    expect(screen.getByText("b:Zz")).toBeTruthy();
    expect(await screen.findByText("b:-")).toBeTruthy();
    expect(await screen.findByText("Couldn't save that change.")).toBeTruthy();
  });

  it("an unknown task changes nothing", () => {
    const { wrap } = setup([a]);
    render(wrap(<Probe />));
    act(() => {
      handle.store!.reorder(new Map([["zz", "a1"]]), "day_order")();
    });
    expect(screen.getByText("a:a0")).toBeTruthy();
  });
});
