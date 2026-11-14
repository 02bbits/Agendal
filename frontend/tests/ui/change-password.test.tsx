import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePassword } from "../../src/ui/features/shell/ChangePassword";

describe("ChangePassword (issue #149 B4)", () => {
  const email = "user@example.com";
  const jsonResponse = (status: number, body: unknown, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("empty new password shows no ticks even when current password is typed", async () => {
    const user = userEvent.setup();
    render(<ChangePassword email={email} onBack={vi.fn()} />);

    const checklist = screen.getByRole("list");
    // No svg check icons in checklist initially
    expect(checklist.querySelectorAll("svg").length).toBe(0);

    const currentInput = screen.getByLabelText("Current password");
    await user.type(currentInput, "oldPassword123");

    // Still no ticks because new password is empty
    expect(checklist.querySelectorAll("svg").length).toBe(0);
  });

  it("checks checklist rules and live match feedback with updated copy", async () => {
    const user = userEvent.setup();
    render(<ChangePassword email={email} onBack={vi.fn()} />);

    const currentInput = screen.getByLabelText("Current password");
    const newInput = screen.getByLabelText("New password");
    const confirmInput = screen.getByLabelText("Confirm new password");
    const saveBtn = screen.getByRole("button", { name: "Save" });

    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    await user.type(currentInput, "oldPassword123");
    await user.type(newInput, "newPassword123");

    // Type confirm mismatch
    await user.type(confirmInput, "mismatch");
    expect(screen.getByText("New passwords don't match.")).toBeTruthy();
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    // Type confirm match
    await user.clear(confirmInput);
    await user.type(confirmInput, "newPassword123");
    expect(screen.getByText("New passwords match")).toBeTruthy();

    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("checks current password on blur: 204 verified, 422 shows error, typing clears error", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<ChangePassword email={email} onBack={vi.fn()} />);

    const currentInput = screen.getByLabelText("Current password");
    await user.type(currentInput, "correctPassword123");
    await user.tab();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/check-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ current_password: "correctPassword123" }),
      }),
    );
    expect(screen.queryByText("That's not your current password.")).toBeNull();

    // Now test 422 on blur
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "auth.current_password_wrong",
          message: "That's not your current password.",
        },
      }),
    );

    await user.click(currentInput);
    await user.clear(currentInput);
    await user.type(currentInput, "wrongPassword123");
    await user.tab();

    expect(
      await screen.findByText("That's not your current password."),
    ).toBeTruthy();

    // Typing in the field clears the error
    await user.type(currentInput, "a");
    expect(screen.queryByText("That's not your current password.")).toBeNull();
  });

  it("successful password change shows success state with focused heading, Done calls onBack, no toast", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const showToast = vi.fn();

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("check-password")) {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(200, { user: { id: "1", email } });
    });

    render(
      <ChangePassword email={email} onBack={onBack} showToast={showToast} />,
    );

    await user.type(
      screen.getByLabelText("Current password"),
      "correctPassword123",
    );
    await user.type(
      screen.getByLabelText("New password"),
      "brandNewPassword123",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "brandNewPassword123",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    // Status region shown
    const statusRegion = await screen.findByRole("status");
    expect(statusRegion).toBeTruthy();

    // Heading focused
    const heading = screen.getByRole("heading", { name: "Password changed" });
    expect(document.activeElement).toBe(heading);

    // Body text with email
    expect(
      screen.getByText(
        `Your other devices were signed out. We sent a note to ${email}.`,
      ),
    ).toBeTruthy();

    // No toast called
    expect(showToast).not.toHaveBeenCalled();

    // Done button calls onBack
    const doneBtn = screen.getByRole("button", { name: "Done" });
    await user.click(doneBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows rate limit error on 429 response", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("check-password")) {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(
        429,
        { error: { message: "Too many attempts", retry_after: 900 } },
        { "Retry-After": "900" },
      );
    });

    render(<ChangePassword email={email} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText("Current password"), "pass12345");
    await user.type(screen.getByLabelText("New password"), "pass67890");
    await user.type(screen.getByLabelText("Confirm new password"), "pass67890");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("900");
  });

  it("Tab from Current password lands on New password; Alt+F8 on a field flips its type between password and text", async () => {
    const user = userEvent.setup();
    render(<ChangePassword email={email} onBack={vi.fn()} />);

    const currentInput = screen.getByLabelText("Current password");
    const newInput = screen.getByLabelText("New password");

    currentInput.focus();
    expect(document.activeElement).toBe(currentInput);

    await user.tab();
    expect(document.activeElement).toBe(newInput);

    expect(newInput.getAttribute("type")).toBe("password");
    expect(newInput.getAttribute("aria-keyshortcuts")).toBe("Alt+F8");

    await user.keyboard("{Alt>}{F8}{/Alt}");
    expect(newInput.getAttribute("type")).toBe("text");

    await user.keyboard("{Alt>}{F8}{/Alt}");
    expect(newInput.getAttribute("type")).toBe("password");
  });
});
