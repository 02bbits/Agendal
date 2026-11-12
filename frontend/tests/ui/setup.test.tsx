import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupScreen } from "../../src/ui/features/auth/SetupScreen";
import { setTimeZone } from "../../src/lib/clock";

describe("SetupScreen (issue #149 B2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-11T14:30:00Z"));
    setTimeZone("UTC");
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeZone(undefined);
  });

  it("renders the three fields with radio groups and accessible names", () => {
    render(<SetupScreen />);

    expect(screen.getByText("Week starts on")).toBeTruthy();
    expect(screen.getByText("Time format")).toBeTruthy();
    expect(screen.getByText("Time zone")).toBeTruthy();

    const radioGroups = screen.getAllByRole("radiogroup");
    expect(radioGroups).toHaveLength(2); // week start and time format

    expect(screen.getByRole("radio", { name: "Monday" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Sunday" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "24-hour" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "12-hour" })).toBeTruthy();
  });

  it("focuses on the heading on load", () => {
    render(<SetupScreen />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Set up Agendal",
    });
    expect(document.activeElement).toBe(heading);
  });

  it("changing time format updates the live example", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SetupScreen initialTimeFormat="24h" />);

    expect(screen.getByText(/Now:\s*14:30/)).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "12-hour" }));
    expect(screen.getByText(/Now:\s*2:30\s*pm/i)).toBeTruthy();
  });

  it("Continue sends the right body for auto zone", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onContinue = vi.fn().mockResolvedValue(undefined);
    render(
      <SetupScreen
        initialWeekStart="mon"
        initialTimeFormat="24h"
        onContinue={onContinue}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledWith({
      week_start: "mon",
      time_format: "24h",
      timezone_auto: true,
    });
  });

  it("Continue sends the right body for manual zone", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onContinue = vi.fn().mockResolvedValue(undefined);
    render(
      <SetupScreen
        initialWeekStart="mon"
        initialTimeFormat="24h"
        onContinue={onContinue}
      />,
    );

    // Open zone change
    await user.click(screen.getByRole("button", { name: "Change" }));

    // Select London
    const londonOption = screen.getByRole("option", { name: "Europe/London" });
    await user.click(londonOption);

    // Link to use device's time zone should now be visible
    expect(
      screen.getByRole("button", { name: "Use this device's time zone" }),
    ).toBeTruthy();

    // Click continue
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledWith({
      week_start: "mon",
      time_format: "24h",
      timezone: "Europe/London",
    });
  });

  it("Skip sends nothing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onContinue = vi.fn();
    const onSkip = vi.fn();
    render(<SetupScreen onContinue={onContinue} onSkip={onSkip} />);

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(onContinue).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("time zone panel opens, filters, picks, and closes on Escape with focus back on the button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SetupScreen />);

    const changeButton = screen.getByRole("button", { name: "Change" });
    expect(screen.queryByRole("listbox")).toBeNull();

    // Opens
    await user.click(changeButton);
    expect(screen.getByRole("listbox")).toBeTruthy();
    const searchInput = screen.getByLabelText("Search time zones");
    expect(document.activeElement).toBe(searchInput);

    // Filters
    await user.type(searchInput, "Tokyo");
    expect(screen.getByRole("option", { name: "Asia/Tokyo" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Europe/London" })).toBeNull();

    // Picks
    await user.click(screen.getByRole("option", { name: "Asia/Tokyo" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText(/Asia\/Tokyo/)).toBeTruthy();

    // Re-open and close on Escape with focus back on the button
    await user.click(changeButton);
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(changeButton);
  });
});
