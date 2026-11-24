import { act, render, screen } from "@testing-library/react";
import { Activity, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { InboxScreen } from "../../src/ui/features/lists/InboxScreen";
import { useTaskStore } from "../../src/ui/features/tasks/store";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Stands in for the task panel: edits go through the same store update
const panel: { edit: ReturnType<typeof useTaskStore>["update"] } = {
  edit: () => ({}),
};
function Editor() {
  const { update } = useTaskStore();
  useEffect(() => {
    panel.edit = update;
  });
  return null;
}

const titles = () =>
  screen
    .getAllByRole("checkbox")
    .map((box) => box.getAttribute("aria-label") ?? "");

describe("Inbox keeps an edited task in place until the user leaves the screen (Spec 01 §5)", () => {
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

  it("changing the time in the panel doesn't move the row, even after it closes", async () => {
    const { wrap } = setup([early, late]);
    // Next hides the page it leaves in <Activity> rather than unmounting it
    const ui = (selected: string | null, shown = true) =>
      wrap(
        <>
          <Activity mode={shown ? "visible" : "hidden"}>
            <InboxScreen accountInitial="e" selectedTaskId={selected} />
          </Activity>
          <Editor />
        </>,
      );
    const { rerender } = render(ui("late"));
    const before = titles();

    await act(async () => {
      panel.edit("late", { start_time: "07:00" });
    });
    expect(titles()).toEqual(before);

    rerender(ui(null));
    expect(titles()).toEqual(before);

    // Leaving the screen and coming back sorts again
    act(() => rerender(ui(null, false)));
    act(() => rerender(ui(null)));
    expect(titles()).not.toEqual(before);
  });
});
