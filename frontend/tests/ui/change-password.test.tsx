import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePassword } from "../../src/ui/features/shell/ChangePassword";
import { t } from "../../src/ui/copy";

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

  it("checks checklist rules and live match feedback while typing", async () => {
    const user = userEvent.setup();
    render(<ChangePassword email={email} onBack={vi.fn()} />);

    const currentInput = screen.getByLabelText("Current password");
    const newInput = screen.getByLabelText("New password");
    const confirmInput = screen.getByLabelText("Confirm new password");
    const saveBtn = screen.getByRole("button", { name: "Save" });

    // Initially Save is disabled
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    // Rule "Different from your current password" is not shown until current has value
    expect(
      screen.queryByText("Different from your current password"),
    ).toBeNull();

    await user.type(currentInput, "oldPassword123");
    // Now "Different from your current password" appears
    expect(
      screen.getByText("Different from your current password"),
    ).toBeTruthy();

    // Type new password same as email
    await user.type(newInput, email);
    // At least 8 characters passes, but Not your email does not
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    await user.clear(newInput);
    await user.type(newInput, "newPassword123");

    // Type confirm mismatch
    await user.type(confirmInput, "mismatch");
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    // Type confirm match
    await user.clear(confirmInput);
    await user.type(confirmInput, "newPassword123");
    expect(screen.getByText("Passwords match")).toBeTruthy();

    // Now save is enabled
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("wrong current password shows error and focuses/selects current password input", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "auth.current_password_wrong",
          message: "That's not your current password.",
          fields: {
            current_password: ["That's not your current password."],
          },
        },
      }),
    );

    render(<ChangePassword email={email} onBack={vi.fn()} />);

    const currentInput = screen.getByLabelText("Current password");
    const newInput = screen.getByLabelText("New password");
    const confirmInput = screen.getByLabelText("Confirm new password");

    await user.type(currentInput, "wrongPassword123");
    await user.type(newInput, "validNewPassword123");
    await user.type(confirmInput, "validNewPassword123");

    const saveBtn = screen.getByRole("button", { name: "Save" });
    await user.click(saveBtn);

    expect(
      await screen.findByText("That's not your current password."),
    ).toBeTruthy();
    expect(document.activeElement).toBe(currentInput);
  });

  it("successful password change calls showToast and onBack", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const showToast = vi.fn();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: { id: "1", email },
      }),
    );

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

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/change-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          current_password: "correctPassword123",
          password: "brandNewPassword123",
          password_confirmation: "brandNewPassword123",
        }),
      }),
    );

    expect(showToast).toHaveBeenCalledWith(t("auth.password_changed"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows rate limit error on 429 response", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        429,
        { error: { message: "Too many attempts", retry_after: 900 } },
        { "Retry-After": "900" },
      ),
    );

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
