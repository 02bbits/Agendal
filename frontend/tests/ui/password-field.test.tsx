import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordField } from "../../src/ui/features/auth/PasswordField";

describe("PasswordField - Vietnamese typing and Caps Lock warnings (issue #149)", () => {
  it("says nothing about accented letters while typing: the form reports them on submit", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" />);

    await user.type(screen.getByLabelText("Password"), "mật khẩu");
    expect(screen.queryByText(/accented|Vietnamese typing/i)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the Caps Lock warning on keydown when CapsLock modifier is active, and clears on blur", () => {
    render(<PasswordField label="Password" />);

    const input = screen.getByLabelText("Password");
    input.focus();

    expect(screen.queryByText("Caps Lock is on.")).toBeNull();

    // Trigger keydown with CapsLock modifier active
    fireEvent.keyDown(input, {
      key: "a",
      modifierCapsLock: true,
      getModifierState: (key: string) => key === "CapsLock",
    });

    expect(screen.getByText("Caps Lock is on.")).toBeTruthy();

    // Blur clears the warning
    fireEvent.blur(input);
    expect(screen.queryByText("Caps Lock is on.")).toBeNull();
  });
});
