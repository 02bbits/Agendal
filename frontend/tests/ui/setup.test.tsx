import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupScreen } from "../../src/ui/features/auth/SetupScreen";
import { setTimeZone } from "../../src/lib/clock";

describe("SetupScreen (issue #149 D)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-11T14:30:00Z"));
    setTimeZone("UTC");
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeZone(undefined);
  });

  it("focuses on the heading on load", () => {
    render(<SetupScreen initialName="Alex" />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Set up Agendal",
    });
    expect(document.activeElement).toBe(heading);
  });

  it("Step 1: requires a non-empty name <= 60 characters to advance", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SetupScreen initialName="" />);

    const nextBtn = screen.getByRole("button", {
      name: "Continue",
    }) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    const nameInput = screen.getByLabelText("What should we call you?");
    await user.type(nameInput, "   ");
    expect(nextBtn.disabled).toBe(true);

    // Type a valid name
    await user.clear(nameInput);
    await user.type(nameInput, "Alex Rivers");
    expect(nextBtn.disabled).toBe(false);

    // Too long name (> 60 chars)
    await user.clear(nameInput);
    await user.type(nameInput, "A".repeat(61));
    expect(nextBtn.disabled).toBe(true);
    expect(screen.getByText("Use 60 characters or fewer.")).toBeTruthy();

    // Valid name again
    await user.clear(nameInput);
    await user.type(nameInput, "Alex");
    expect(nextBtn.disabled).toBe(false);
  });

  it("navigates through all 3 steps and submits complete payload on Finish", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onContinue = vi.fn().mockResolvedValue(undefined);

    render(
      <SetupScreen
        initialName="Jordan"
        initialWeekStart="mon"
        initialTimeFormat="24h"
        onContinue={onContinue}
      />,
    );

    // Step 1: Name is prefilled, click Continue
    const nextBtn = screen.getByRole("button", { name: "Continue" });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false);
    await user.click(nextBtn);

    // Step 2: Dates and times
    expect(screen.getByText("Week starts on")).toBeTruthy();
    expect(screen.getByText("Time format")).toBeTruthy();
    expect(screen.getByText("Time zone")).toBeTruthy();

    // Change to 12-hour format and Sunday
    await user.click(screen.getByRole("radio", { name: "Sunday" }));
    await user.click(screen.getByRole("radio", { name: "12-hour" }));
    expect(screen.getByText(/Now:\s*2:30\s*pm/i)).toBeTruthy();

    // Advance to Step 3: Security
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Step 3: Security
    expect(screen.getByText("Two-step verification")).toBeTruthy();
    const switchToggle = screen.getByRole("switch", {
      name: "Two-step verification",
    });
    // 2FA toggle off by default
    expect(switchToggle.getAttribute("aria-checked")).toBe("false");

    // Click Finish
    const finishBtn = screen.getByRole("button", { name: "Finish" });
    await user.click(finishBtn);

    expect(onContinue).toHaveBeenCalledWith({
      display_name: "Jordan",
      week_start: "sun",
      time_format: "12h",
      timezone_auto: true,
      two_factor_enabled: false,
    });
  });

  it("allows enabling 2FA in step 3 and submits two_factor_enabled: true", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onContinue = vi.fn().mockResolvedValue(undefined);

    render(<SetupScreen initialName="Taylor" onContinue={onContinue} />);

    // Step 1 -> Step 2
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Step 2 -> Step 3
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Toggle 2FA switch
    const switchToggle = screen.getByRole("switch", {
      name: "Two-step verification",
    });
    await user.click(switchToggle);
    expect(switchToggle.getAttribute("aria-checked")).toBe("true");

    // Finish
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onContinue).toHaveBeenCalledWith({
      display_name: "Taylor",
      week_start: "mon",
      time_format: "24h",
      timezone_auto: true,
      two_factor_enabled: true,
    });
  });

  it("submits manual timezone when chosen in step 2", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onContinue = vi.fn().mockResolvedValue(undefined);

    render(<SetupScreen initialName="Sam" onContinue={onContinue} />);

    // Advance to step 2
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Open zone change
    await user.click(screen.getByRole("button", { name: "Change" }));

    // Select London
    const londonOption = screen.getByRole("option", { name: "Europe/London" });
    await user.click(londonOption);

    // Advance to step 3
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Finish
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onContinue).toHaveBeenCalledWith({
      display_name: "Sam",
      week_start: "mon",
      time_format: "24h",
      timezone: "Europe/London",
      two_factor_enabled: false,
    });
  });

  it("Skip sends nothing and calls onSkip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onContinue = vi.fn();
    const onSkip = vi.fn();

    render(
      <SetupScreen
        initialName="Casey"
        onContinue={onContinue}
        onSkip={onSkip}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(onContinue).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
