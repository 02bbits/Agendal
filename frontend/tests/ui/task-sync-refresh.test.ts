import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTaskSync } from "../../src/ui/features/tasks/useTaskSync";
import { task } from "./fixtures";

// A list refetched after a note is applied or undone reaches the store (RV-2, WF-04 step 3)
describe("useTaskSync refetched rows", () => {
  it("takes a new list from its parent, but not a new array with the same rows", () => {
    const a = task({ id: "a", title: "A" });
    const { result, rerender } = renderHook(({ rows }) => useTaskSync(rows), {
      initialProps: { rows: [a] },
    });

    rerender({ rows: [a, task({ id: "b", title: "B" })] });
    expect(result.current.tasks.map((t) => t.id)).toEqual(["a", "b"]);

    rerender({ rows: [task({ id: "b", title: "B" })] });
    expect(result.current.tasks.map((t) => t.id)).toEqual(["b"]);
  });

  it("keeps the local row of a task still saving", async () => {
    const a = task({ id: "a", title: "A" });
    let finish: (saved: typeof a) => void = () => {};
    const { result, rerender } = renderHook(({ rows }) => useTaskSync(rows), {
      initialProps: { rows: [a] },
    });
    act(() =>
      result.current.change(
        "a",
        { title: "Renamed" },
        () => new Promise((resolve) => (finish = resolve)),
      ),
    );

    rerender({ rows: [{ ...a, priority: "high" }] });
    expect(result.current.tasks[0]!.title).toBe("Renamed");

    await act(async () => finish({ ...a, title: "Renamed" }));
    expect(result.current.tasks[0]!.title).toBe("Renamed");
  });
});
