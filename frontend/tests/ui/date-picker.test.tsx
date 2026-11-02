import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTimeZone } from "../../src/lib/clock";
import { DatePicker } from "../../src/ui/components/DatePicker";
import { expectAxeCleanInBothThemes } from "./axe";

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("DatePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    setTimeZone("UTC");
    mockMatchMedia(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeZone(undefined);
  });

  it("chips set the right dates for fake clock today 2026-10-23", async () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <DatePicker label="Due date" value="2026-10-23" onChange={onChange} />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    await userEvent.click(trigger);

    // Today chip
    const todayChip = screen.getByRole("button", { name: "Today" });
    await userEvent.click(todayChip);
    expect(onChange).toHaveBeenCalledWith("2026-10-23");
    unmount();

    // Tomorrow chip
    const onChangeTomorrow = vi.fn();
    const { unmount: unmount2 } = render(
      <DatePicker label="Due date" value={null} onChange={onChangeTomorrow} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Due date" }));
    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(onChangeTomorrow).toHaveBeenCalledWith("2026-10-24");
    unmount2();

    // Next week chip (Monday of next week -> 2026-10-26)
    const onChangeNextWeek = vi.fn();
    render(
      <DatePicker label="Due date" value={null} onChange={onChangeNextWeek} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Due date" }));
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(onChangeNextWeek).toHaveBeenCalledWith("2026-10-26");
  });

  it("clicking a day calls onChange and closes", async () => {
    const onChange = vi.fn();
    render(
      <DatePicker label="Due date" value="2026-10-23" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Due date" }));

    // Find day 15 in the October grid
    const day15 = screen.getByRole("gridcell", { name: "15" });
    await userEvent.click(day15);

    expect(onChange).toHaveBeenCalledWith("2026-10-15");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("keyboard navigation moves by day, week, home/end, and selects on Enter", async () => {
    const onChange = vi.fn();
    render(
      <DatePicker label="Due date" value="2026-10-23" onChange={onChange} />,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    await userEvent.click(trigger);

    const day23 = screen.getByRole("gridcell", { name: "23" });
    expect(day23).not.toBeNull();

    // ArrowRight moves to 24
    fireEvent.keyDown(day23, { key: "ArrowRight" });
    const day24 = screen.getByRole("gridcell", { name: "24" });
    expect(day24.getAttribute("tabindex")).toBe("0");

    // ArrowUp moves to 17 (one week prior)
    fireEvent.keyDown(day24, { key: "ArrowUp" });
    const day17 = screen.getByRole("gridcell", { name: "17" });
    expect(day17.getAttribute("tabindex")).toBe("0");

    // Home moves to start of week (Monday 12)
    fireEvent.keyDown(day17, { key: "Home" });
    const day12 = screen.getByRole("gridcell", { name: "12" });
    expect(day12.getAttribute("tabindex")).toBe("0");

    // End moves to end of week (Sunday 18)
    fireEvent.keyDown(day12, { key: "End" });
    const day18 = screen.getByRole("gridcell", { name: "18" });
    expect(day18.getAttribute("tabindex")).toBe("0");

    // Enter selects
    fireEvent.keyDown(day18, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("2026-10-18");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("navigates months with previous and next month buttons", async () => {
    render(
      <DatePicker label="Due date" value="2026-10-23" onChange={() => {}} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Due date" }));

    expect(screen.getByText("October 2026")).not.toBeNull();

    const nextBtn = screen.getByRole("button", { name: "Next month" });
    await userEvent.click(nextBtn);
    expect(screen.getByText("November 2026")).not.toBeNull();

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    await userEvent.click(prevBtn);
    expect(screen.getByText("October 2026")).not.toBeNull();
  });

  it("phone width renders a Sheet", async () => {
    mockMatchMedia(false);
    const onChange = vi.fn();
    render(
      <DatePicker label="Due date" value="2026-10-23" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Due date" }));

    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Due date" })).not.toBeNull();

    const day15 = screen.getByRole("gridcell", { name: "15" });
    await userEvent.click(day15);

    expect(onChange).toHaveBeenCalledWith("2026-10-15");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is axe clean in both themes when closed and open", async () => {
    const { container } = render(
      <main>
        <DatePicker label="Due date" value="2026-10-23" onChange={() => {}} />
      </main>,
    );

    await expectAxeCleanInBothThemes(container);

    await userEvent.click(screen.getByRole("button", { name: "Due date" }));
    await expectAxeCleanInBothThemes(container);
  });
});
