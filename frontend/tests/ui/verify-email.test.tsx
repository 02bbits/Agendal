import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { VerifyEmailScreen } from "../../src/ui/features/auth/VerifyEmailScreen";

describe("VerifyEmailScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("complete → success → navigate welcome after 700ms", async () => {
    const onVerify = vi.fn().mockResolvedValue({ ok: true });
    const navigate = vi.fn();

    render(
      <VerifyEmailScreen
        email="test@example.com"
        onVerify={onVerify}
        navigate={navigate}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Verification code" });

    // Enter 6 digits
    for (const d of ["1", "2", "3", "4", "5", "6"]) {
      fireEvent.keyDown(input, { key: d });
    }

    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith("123456");

    // Wait for async handleComplete to resolve onVerify and schedule navigation timeout
    await act(async () => {
      await Promise.resolve();
    });

    // Before 700ms, not navigated yet
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(navigate).not.toHaveBeenCalled();

    // After 700ms total
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(navigate).toHaveBeenCalledWith("/welcome");
  });

  it("wrong → error message, and typing clears the error", async () => {
    const onVerify = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      message: "That code isn't right. Try again.",
    });

    render(<VerifyEmailScreen email="test@example.com" onVerify={onVerify} />);

    const input = screen.getByRole("textbox", { name: "Verification code" });

    // Enter 6 digits
    for (const d of ["0", "0", "0", "0", "0", "0"]) {
      fireEvent.keyDown(input, { key: d });
    }

    // Wait for the async onVerify to resolve
    await act(async () => {
      await Promise.resolve();
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("That code isn't right. Try again.");

    // Advance drain timer for CodeSlots
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Typing a new digit clears the error
    fireEvent.keyDown(input, { key: "1" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resend countdown and success message", async () => {
    const onResend = vi.fn().mockResolvedValue({ ok: true });

    render(<VerifyEmailScreen email="test@example.com" onResend={onResend} />);

    const resendBtn = screen.getByRole("button", {
      name: /Send a new code in 45 s/i,
    }) as HTMLButtonElement;
    expect(resendBtn.disabled).toBe(true);

    // Fast-forward 45 seconds
    act(() => {
      vi.advanceTimersByTime(45000);
    });

    expect(resendBtn.disabled).toBe(false);
    expect(resendBtn.textContent).toBe("Send a new code");

    // Click resend
    await act(async () => {
      fireEvent.click(resendBtn);
    });

    expect(onResend).toHaveBeenCalledTimes(1);

    // Shows polite success message and starts countdown again
    expect(screen.getByRole("status").textContent).toBe("New code sent.");
    expect(resendBtn.disabled).toBe(true);
    expect(resendBtn.textContent).toContain("Send a new code in 45 s");
  });

  it("switch account signs out and navigates to create account", async () => {
    const onSwitchAccount = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();

    render(
      <VerifyEmailScreen
        email="test@example.com"
        onSwitchAccount={onSwitchAccount}
        navigate={navigate}
      />,
    );

    const switchBtn = screen.getByRole("button", {
      name: "Use a different account",
    });

    await act(async () => {
      fireEvent.click(switchBtn);
    });

    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/create-account");
  });
});
