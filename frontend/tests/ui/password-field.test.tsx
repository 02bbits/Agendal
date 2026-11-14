import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "../../src/ui/features/auth/PasswordField";

describe("PasswordField - Vietnamese typing and Caps Lock warnings (issue #149)", () => {
  function Controlled({ onValue }: { onValue?: (value: string) => void }) {
    const [value, setValue] = useState("");
    return (
      <PasswordField
        label="Password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onValue?.(e.target.value);
        }}
      />
    );
  }

  it("accepts native typing without mutating or dropping keys on the fly", () => {
    const seen: string[] = [];
    render(<Controlled onValue={(v) => seen.push(v)} />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Secret123!" } });
    expect(input.value).toBe("Secret123!");
    expect(seen.at(-1)).toBe("Secret123!");
  });

  it("allows emoji and special characters during typing", () => {
    render(<Controlled />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "ab!👍" } });
    expect(input.value).toBe("ab!👍");
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
