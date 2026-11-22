import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InboxScreen } from "../../src/ui/features/lists/InboxScreen";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// #178: Smart or manual order per list, and Sort by rules (Spec 02 §2.1)
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

const todayTitles = () =>
  within(screen.getByRole("heading", { name: /Today/ }).closest("section")!)
    .getAllByRole("checkbox")
    .map((box) => box.getAttribute("aria-label"));

afterEach(() => localStorage.clear());

describe("Sort menu (#178)", () => {
  it("Today starts smart; Manual order follows the keys; Smart goes back to the rules", async () => {
    const { wrap } = setup([early, late]);
    render(wrap(<InboxScreen accountInitial="e" />));
    expect(todayTitles()).toEqual(["Complete Early", "Complete Late"]);

    await userEvent.click(screen.getByRole("button", { name: "Sort Today" }));
    const smart = screen.getByRole("menuitemradio", { name: "Smart order" });
    expect(smart.getAttribute("aria-checked")).toBe("true");
    await expectAxeCleanInBothThemes(document.body);

    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "Manual order" }),
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(todayTitles()).toEqual(["Complete Late", "Complete Early"]);

    await userEvent.click(screen.getByRole("button", { name: "Sort Today" }));
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "Smart order" }),
    );
    expect(todayTitles()).toEqual(["Complete Early", "Complete Late"]);
  });

  it("Sort by rules places the list in rule order, stays manual, and Undo puts it back", async () => {
    const { wrap, memory } = setup([early, late]);
    render(wrap(<InboxScreen accountInitial="e" />));

    await userEvent.click(screen.getByRole("button", { name: "Sort Today" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Sort by rules" }),
    );
    expect(todayTitles()).toEqual(["Complete Early", "Complete Late"]);
    await waitFor(() => {
      const [e, l] = ["early", "late"].map(
        (id) => memory.db.tasks.find((t) => t.id === id)!.day_order!,
      );
      expect(e < l).toBe(true);
    });

    await userEvent.click(screen.getByRole("button", { name: "Sort Today" }));
    expect(
      screen
        .getByRole("menuitemradio", { name: "Manual order" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    await userEvent.keyboard("{Escape}");

    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(todayTitles()).toEqual(["Complete Early", "Complete Late"]);
    await waitFor(() =>
      expect(memory.db.tasks.map((t) => t.day_order)).toEqual(["a1", "a0"]),
    );
  });

  it("Escape closes the menu and gives focus back to its button", async () => {
    const { wrap } = setup([early, late]);
    render(wrap(<InboxScreen accountInitial="e" />));
    const button = screen.getByRole("button", { name: "Sort Today" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
