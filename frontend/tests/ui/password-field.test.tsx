import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordField } from "../../src/ui/features/auth/PasswordField";

describe("PasswordField - Vietnamese typing and Caps Lock warnings (issue #149)", () => {
  it("shows the accented warning when typing Vietnamese accented characters (mật) and hides for ASCII", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" />);

    const input = screen.getByLabelText("Password");

    // Type ASCII
    await user.type(input, "secret123");
    expect(
      screen.queryByText(
        /Vietnamese typing is on: this password has accented letters/i,
      ),
    ).toBeNull();

    // Type Vietnamese accented letters
    await user.clear(input);
    await user.type(input, "mật");
    expect(
      screen.getByText(
        "Vietnamese typing is on: this password has accented letters. Turn off Unikey (Ctrl+Shift) or show the password to check.",
      ),
    ).toBeTruthy();

    // Clear and type ASCII again
    await user.clear(input);
    await user.type(input, "password");
    expect(
      screen.queryByText(
        /Vietnamese typing is on: this password has accented letters/i,
      ),
    ).toBeNull();
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
