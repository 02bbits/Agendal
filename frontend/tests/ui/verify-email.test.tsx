import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatWait } from "../../src/ui/features/auth/CodeEntry";
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
      name: /Send a new code in 1:00/i,
    }) as HTMLButtonElement;
    expect(resendBtn.disabled).toBe(true);

    // Fast-forward 60 seconds
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(resendBtn.disabled).toBe(false);
    expect(resendBtn.textContent).toBe("Send a new code");

    // Click resend
    await act(async () => {
      fireEvent.click(resendBtn);
    });

    expect(onResend).toHaveBeenCalledTimes(1);

    // Shows polite success message and starts countdown again
    expect(screen.getByRole("status").textContent).toContain("New code sent.");
    expect(resendBtn.disabled).toBe(true);
    expect(resendBtn.textContent).toContain("Send a new code in 1:00");
  });

  const slotsText = () =>
    Array.from(document.querySelectorAll(".code-slots__slot"))
      .map((slot) => (slot.hasAttribute("data-filled") ? "x" : "_"))
      .join("");

  it("PR #153: while a full code is checked, more digits change nothing", async () => {
    let answer: (value: { ok: boolean; status: number }) => void = () => {};
    const onVerify = vi.fn(
      () =>
        new Promise<{ ok: boolean; status: number }>((resolve) => {
          answer = resolve;
        }),
    );
    render(<VerifyEmailScreen email="test@example.com" onVerify={onVerify} />);
    const input = screen.getByRole("textbox", { name: "Verification code" });

    for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      fireEvent.keyDown(input, { key: d });
    }
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith("123456");
    expect((input as HTMLInputElement).disabled).toBe(true);

    await act(async () => {
      answer({ ok: false, status: 422 });
      await Promise.resolve();
    });
    expect((input as HTMLInputElement).disabled).toBe(false);
  });

  it("PR #153: a used-up code empties and disables the slots until a new code is sent", async () => {
    const onVerify = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      code: "auth.verify_too_many",
      message: "Too many tries. Send a new code.",
    });
    const onResend = vi.fn().mockResolvedValue({ ok: true });
    render(
      <VerifyEmailScreen
        email="test@example.com"
        onVerify={onVerify}
        onResend={onResend}
      />,
    );
    const input = screen.getByRole("textbox", {
      name: "Verification code",
    }) as HTMLInputElement;

    for (const d of ["1", "2", "3", "1", "2", "3"]) {
      fireEvent.keyDown(input, { key: d });
    }
    await act(async () => {
      await Promise.resolve();
    });

    expect(slotsText()).toBe("______");
    expect(input.disabled).toBe(true);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Too many tries for this code.");
    expect(alert.textContent).toContain("You can send a new code in 1:00.");

    // Typing does nothing while the code is used up
    fireEvent.keyDown(input, { key: "4" });
    expect(slotsText()).toBe("______");

    // Once the 60 s pass, Send a new code is the next step and opens the slots again
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(alert.textContent).toContain("Send a new code to keep going.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    });
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("New code sent.");
  });

  it("PR #153: past 10 codes in 30 minutes, the wait shows in minutes", async () => {
    const onResend = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 429, retryAfter: 1800 });
    render(<VerifyEmailScreen email="test@example.com" onResend={onResend} />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    });

    expect(screen.getByRole("alert").textContent).toContain(
      "You've asked for a lot of codes.",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "You can send a new code in 30:00.",
    );
    // The notice counts down, so the disabled button only says what it does
    const button = screen.getByRole("button", {
      name: "Send a new code",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("formats waits as seconds under a minute and m:ss above", () => {
    expect(formatWait(45)).toBe("45 s");
    expect(formatWait(60)).toBe("1:00");
    expect(formatWait(1799)).toBe("29:59");
  });

  it("PR #153: a new code empties the slots", async () => {
    const onVerify = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    const onResend = vi.fn().mockResolvedValue({ ok: true });
    render(
      <VerifyEmailScreen
        email="test@example.com"
        onVerify={onVerify}
        onResend={onResend}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Verification code" });
    for (const d of ["1", "2", "3"]) {
      fireEvent.keyDown(input, { key: d });
    }
    expect(slotsText()).toBe("xxx___");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(slotsText()).toBe("______");
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
