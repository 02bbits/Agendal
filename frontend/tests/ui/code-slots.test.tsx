import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import CodeSlots from "../../src/ui/components/CodeSlots";

describe("CodeSlots component", () => {
  it("typing six digits calls onComplete once with the code", async () => {
    const onComplete = vi.fn();
    const onChange = vi.fn();
    render(<CodeSlots onComplete={onComplete} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Verification code" });

    // Type 6 digits
    for (const d of ["1", "2", "3", "4", "5", "6"]) {
      fireEvent.keyDown(input, { key: d });
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
    expect(onChange).toHaveBeenLastCalledWith("123456");
  });

  it('paste of "12 34 56" fills all', () => {
    const onComplete = vi.fn();
    const onChange = vi.fn();
    render(<CodeSlots onComplete={onComplete} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Verification code" });

    fireEvent.paste(input, {
      clipboardData: {
        getData: (type: string) => (type === "text" ? "12 34 56" : ""),
      },
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
    expect(onChange).toHaveBeenCalledWith("123456");
    expect(screen.getByText("6 of 6 digits entered")).toBeTruthy();
  });

  it("Backspace clears back", () => {
    const onChange = vi.fn();
    render(<CodeSlots defaultValue="123" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Verification code" });

    // Active starts at index 3 (first empty slot)
    // Pressing Backspace clears index 2 ('3') and steps back to index 2
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith("12");

    // Pressing Backspace again clears index 1 ('2') and steps back to index 1
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("non-digits ignored", () => {
    const onChange = vi.fn();
    render(<CodeSlots onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Verification code" });

    fireEvent.keyDown(input, { key: "a" });
    fireEvent.keyDown(input, { key: "!" });
    fireEvent.keyDown(input, { key: " " });

    expect(onChange).not.toHaveBeenCalled();
  });

  describe("status transitions", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("status error clears the code after the drain (fake timers)", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <CodeSlots defaultValue="123456" onChange={onChange} status="idle" />,
      );

      // Transition to error
      rerender(
        <CodeSlots defaultValue="123456" onChange={onChange} status="error" />,
      );

      // Advance past drain timer
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onChange).toHaveBeenCalledWith("");
    });
  });

  it("success makes the input read-only", () => {
    render(<CodeSlots status="success" defaultValue="123456" />);

    const input = screen.getByRole("textbox", {
      name: "Verification code",
    }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it("after status='success' the row gets data-covered, and going back to idle removes it", async () => {
    const { rerender, container } = render(
      <CodeSlots status="idle" defaultValue="123456" />,
    );
    const row = container.querySelector(".code-slots__row")!;
    expect(row.hasAttribute("data-covered")).toBe(false);

    rerender(<CodeSlots status="success" defaultValue="123456" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(row.hasAttribute("data-covered")).toBe(true);

    rerender(<CodeSlots status="idle" defaultValue="123456" />);
    expect(row.hasAttribute("data-covered")).toBe(false);
  });
});
