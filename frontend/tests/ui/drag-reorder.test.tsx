import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/ui/domain/types";
import { InboxScreen } from "../../src/ui/features/lists/InboxScreen";
import { useDropReorder } from "../../src/ui/features/lists/useDropReorder";
import { readSortMode } from "../../src/ui/features/lists/useSortMode";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// #178: a row dropped in its own list (the pointer and keyboard drag itself is dnd-kit's,
// checked in the browser; jsdom has no layout to drag across)
const a = task({ id: "a", title: "A", start_date: TODAY, start_time: "08:00" });
const b = task({ id: "b", title: "B", start_date: TODAY, start_time: "09:00" });
const c = task({ id: "c", title: "C", start_date: TODAY, start_time: "10:00" });

const drop: { move?: (shown: Task[], id: string, to: number) => void } = {};
function Dropper() {
  const move = useDropReorder("today", "day_order");
  useEffect(() => {
    drop.move = move;
  });
  return null;
}

afterEach(() => localStorage.clear());

describe("dropping a row in its own list (#178)", () => {
  it("in smart mode: places it, switches to manual, and Undo puts both back", async () => {
    const { wrap, memory } = setup([a, b, c]);
    render(
      wrap(
        <>
          <InboxScreen accountInitial="e" />
          <Dropper />
        </>,
      ),
    );
    const titles = () =>
      screen
        .getAllByRole("button", { name: /^Move / })
        .map((h) => h.getAttribute("aria-label"));
    expect(titles()).toEqual(["Move A", "Move B", "Move C"]);

    act(() => drop.move!([a, b, c], "c", 0));
    expect(titles()).toEqual(["Move C", "Move A", "Move B"]);
    expect(readSortMode("today")).toBe("manual");
    // Dropped at the top of a list never placed: one key, nobody else written
    await waitFor(() =>
      expect(
        memory.db.tasks.filter((t) => t.day_order).map((t) => t.id),
      ).toEqual(["c"]),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(readSortMode("today")).toBe("smart");
    expect(titles()).toEqual(["Move A", "Move B", "Move C"]);
    await waitFor(() =>
      expect(memory.db.tasks.every((t) => !t.day_order)).toBe(true),
    );
  });

  it("in manual mode: places it without a toast", async () => {
    localStorage.setItem("agendal.sort_modes", '{"today":"manual"}');
    const { wrap } = setup([a, b, c]);
    render(
      wrap(
        <>
          <InboxScreen accountInitial="e" />
          <Dropper />
        </>,
      ),
    );
    act(() => drop.move!([a, b, c], "a", 2));
    expect(screen.queryByText("Switched to manual order")).toBeNull();
    expect(
      screen
        .getAllByRole("button", { name: /^Move / })
        .map((h) => h.getAttribute("aria-label")),
    ).toEqual(["Move B", "Move C", "Move A"]);
  });

  it("every row has a labelled move handle that explains the keys, and the list stays accessible", async () => {
    const { wrap } = setup([a, b]);
    render(wrap(<InboxScreen accountInitial="e" />));
    const handle = screen.getByRole("button", { name: "Move A" });
    const help = document.getElementById(
      handle.getAttribute("aria-describedby")!,
    );
    expect(help?.textContent).toMatch(/press Space/);
    await expectAxeCleanInBothThemes(document.body);
  });
});
