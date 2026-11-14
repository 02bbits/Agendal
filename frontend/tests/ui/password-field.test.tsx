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

  it("AA §2.10: Vietnamese typing (Unikey) gives the keys pressed: A, A is AA, not Â", () => {
    const seen: string[] = [];
    render(<Controlled onValue={(v) => seen.push(v)} />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    // What Unikey sends: "A", then Backspace and "Â" a moment later
    fireEvent.change(input, { target: { value: "A" }, timeStamp: 1000 });
    fireEvent.change(input, { target: { value: "" }, timeStamp: 1200 });
    fireEvent.change(input, { target: { value: "Â" }, timeStamp: 1202 });

    expect(input.value).toBe("AA");
    expect(seen.at(-1)).toBe("AA");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("AA §2.10: other scripts can't be typed, with a short note; emoji stay", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    await user.type(input, "ab");
    fireEvent.change(input, { target: { value: "abパ" }, timeStamp: 5000 });
    expect(input.value).toBe("ab");
    expect(screen.getByRole("status").textContent).toBe(
      "Only English keyboard letters, numbers, symbols and emoji can be used.",
    );

    // An emoji keyboard inserts the whole emoji at once
    fireEvent.change(input, { target: { value: "ab!👍" }, timeStamp: 6000 });
    expect(input.value).toBe("ab!👍");
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
