import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToast } from "../../src/app/frame/useToast";
import { ToastStack, type ToastData } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";

const toast = (id: number, onAction = vi.fn()): ToastData => ({
  id,
  message: `Completed “Task ${id}”`,
  actionLabel: "Undo",
  onAction,
});

/** The toasts' messages, top to bottom. */
const shown = () =>
  [...screen.getByRole("status").querySelectorAll(".alert")].map(
    (alert) => alert.querySelector("span.min-w-0")?.textContent,
  );

afterEach(() => vi.useRealTimers());

describe("#168: up to three toasts at once", () => {
  it("useToast keeps the last three, oldest first, and dismisses only the one asked", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      for (const n of [1, 2, 3, 4]) result.current.showToast(`Toast ${n}`);
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual([
      "Toast 2",
      "Toast 3",
      "Toast 4",
    ]);
    act(() => result.current.dismissToast(result.current.toasts[1]!.id));
    expect(result.current.toasts.map((t) => t.message)).toEqual([
      "Toast 2",
      "Toast 4",
    ]);
  });

  it("shows the newest on top and the oldest at the bottom, three at most", async () => {
    render(
      <ToastStack
        toasts={[toast(1), toast(2), toast(3), toast(4)]}
        onDismiss={() => {}}
      />,
    );
    expect(shown()).toEqual([
      "Completed “Task 4”",
      "Completed “Task 3”",
      "Completed “Task 2”",
    ]);
    // New ones are read out as they come, not the whole stack again
    expect(screen.getByRole("status").getAttribute("aria-atomic")).toBe(
      "false",
    );
    await expectAxeCleanInBothThemes();
  });

  it("each toast's Undo undoes its own action and closes only that toast", async () => {
    const undo = [vi.fn(), vi.fn(), vi.fn()];
    const onDismiss = vi.fn();
    render(
      <ToastStack
        toasts={[toast(1, undo[0]), toast(2, undo[1]), toast(3, undo[2])]}
        onDismiss={onDismiss}
      />,
    );
    const middle = screen.getByText("Completed “Task 2”").closest(".alert")!;
    await userEvent.click(
      within(middle as HTMLElement).getByRole("button", { name: "Undo" }),
    );
    expect(undo[1]).toHaveBeenCalledOnce();
    expect(undo[0]).not.toHaveBeenCalled();
    expect(undo[2]).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledWith(2);
  });

  it("each toast times out on its own after 5 s", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <ToastStack toasts={[toast(1)]} onDismiss={onDismiss} />,
    );
    act(() => vi.advanceTimersByTime(3000));
    rerender(
      <ToastStack toasts={[toast(1), toast(2)]} onDismiss={onDismiss} />,
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(onDismiss.mock.calls).toEqual([[1]]);
    act(() => vi.advanceTimersByTime(3000));
    expect(onDismiss.mock.calls).toEqual([[1], [2]]);
  });

  it("hovering one toast holds every timer, and they start again after (WCAG 2.2.1)", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<ToastStack toasts={[toast(1), toast(2)]} onDismiss={onDismiss} />);
    const top = screen.getByText("Completed “Task 2”").closest(".alert")!;
    fireEvent.mouseEnter(top);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(top);
    act(() => vi.advanceTimersByTime(5000));
    expect(onDismiss.mock.calls).toEqual(expect.arrayContaining([[1], [2]]));
  });

  it("renders toasts with uniform full width on mobile, fixed width on desktop, and truncates long titles", () => {
    const longTitle =
      "Completed “Họp nhóm đồ án Web Nâng Cao và Báo cáo cuối kỳ môn học”";
    render(
      <ToastStack
        toasts={[
          { id: 1, message: "Completed “Short”" },
          { id: 2, message: longTitle },
        ]}
        onDismiss={() => {}}
      />,
    );
    const alerts = screen.getByRole("status").querySelectorAll(".alert");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) {
      expect(alert.className).toContain("w-full");
      expect(alert.className).toContain("md:w-[380px]");
    }
    const longMsgSpan = screen.getByTitle(longTitle);
    expect(longMsgSpan).toBeTruthy();
    expect(longMsgSpan.className).toContain("truncate");
  });
});
