import { render, screen, within } from "@testing-library/react";
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

    await userEvent.click(screen.getByRole("button", { name: "Sort Inbox" }));
    const smart = screen.getByRole("menuitemradio", { name: "Smart order" });
    expect(smart.getAttribute("aria-checked")).toBe("true");
    await expectAxeCleanInBothThemes(document.body);

    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "Manual order" }),
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(todayTitles()).toEqual(["Complete Late", "Complete Early"]);

    await userEvent.click(screen.getByRole("button", { name: "Sort Inbox" }));
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "Smart order" }),
    );
    expect(todayTitles()).toEqual(["Complete Early", "Complete Late"]);
  });

  it("does not offer Sort by rules (dragging in smart order automatically switches to manual)", async () => {
    const { wrap } = setup([early, late]);
    render(wrap(<InboxScreen accountInitial="e" />));

    await userEvent.click(screen.getByRole("button", { name: "Sort Inbox" }));
    expect(
      screen.queryByRole("menuitem", { name: "Sort by rules" }),
    ).toBeNull();
    expect(
      screen.getByRole("menuitemradio", { name: "Smart order" }),
    ).toBeDefined();
    expect(
      screen.getByRole("menuitemradio", { name: "Manual order" }),
    ).toBeDefined();
  });

  it("Escape closes the menu and gives focus back to its button", async () => {
    const { wrap } = setup([early, late]);
    render(wrap(<InboxScreen accountInitial="e" />));
    const button = screen.getByRole("button", { name: "Sort Inbox" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
