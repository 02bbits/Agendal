import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTimeZone } from "../../src/lib/clock";
import { DateField } from "../../src/ui/components/DateField";
import { expectAxeCleanInBothThemes } from "./axe";

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("DateField", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    setTimeZone("UTC");
    mockMatchMedia(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeZone(undefined);
  });

  it("empty shows dd/mm/yyyy", () => {
    render(
      <DateField
        label="Pick date"
        value={null}
        onChange={() => {}}
        weekStart="mon"
      />,
    );

    const day = screen.getByRole("spinbutton", { name: "Day" });
    const month = screen.getByRole("spinbutton", { name: "Month" });
    const year = screen.getByRole("spinbutton", { name: "Year" });

    expect(day.textContent).toBe("dd");
    expect(month.textContent).toBe("mm");
    expect(year.textContent).toBe("yyyy");
  });

  it("typing 2,1,9,0 in year shows '2yyy' -> '21yy' -> '219y' -> '2190'", () => {
    render(
      <DateField
        label="Pick date"
        value={null}
        onChange={() => {}}
        weekStart="mon"
      />,
    );

    const year = screen.getByRole("spinbutton", { name: "Year" });
    year.focus();

    act(() => {
      fireEvent.keyDown(year, { key: "2" });
    });
    expect(year.textContent).toBe("2yyy");

    act(() => {
      fireEvent.keyDown(year, { key: "1" });
    });
    expect(year.textContent).toBe("21yy");

    act(() => {
      fireEvent.keyDown(year, { key: "9" });
    });
    expect(year.textContent).toBe("219y");

    act(() => {
      fireEvent.keyDown(year, { key: "0" });
    });
    expect(year.textContent).toBe("2190");
  });

  it("'3' + Tab gives '03' and focus on month", () => {
    render(
      <DateField
        label="Pick date"
        value={null}
        onChange={() => {}}
        weekStart="mon"
      />,
    );

    const day = screen.getByRole("spinbutton", { name: "Day" });
    const month = screen.getByRole("spinbutton", { name: "Month" });
    day.focus();

    act(() => {
      fireEvent.keyDown(day, { key: "3" });
    });
    expect(day.textContent).toBe("3");

    act(() => {
      fireEvent.keyDown(day, { key: "Tab" });
    });
    expect(day.textContent).toBe("03");
    expect(document.activeElement).toBe(month);
  });

  it("'4' in day auto-advances to month", () => {
    render(
      <DateField
        label="Pick date"
        value={null}
        onChange={() => {}}
        weekStart="mon"
      />,
    );

    const day = screen.getByRole("spinbutton", { name: "Day" });
    const month = screen.getByRole("spinbutton", { name: "Month" });
    day.focus();

    act(() => {
      fireEvent.keyDown(day, { key: "4" });
    });
    expect(day.textContent).toBe("04");
    expect(document.activeElement).toBe(month);
  });

  it("Enter on 03/11/2026 calls onCommit('2026-11-03') and doesn't submit a surrounding form", () => {
    const onCommit = vi.fn();
    const onSubmit = vi.fn((e) => e.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <DateField
          label="Pick date"
          value="2026-11-03"
          onChange={() => {}}
          onCommit={onCommit}
          weekStart="mon"
        />
      </form>,
    );

    const day = screen.getByRole("spinbutton", { name: "Day" });
    day.focus();
    act(() => {
      fireEvent.keyDown(day, { key: "Enter" });
    });

    expect(onCommit).toHaveBeenCalledWith("2026-11-03");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Enter on 31/02/2026 shows the error and doesn't commit", () => {
    const onCommit = vi.fn();

    render(
      <DateField
        label="Pick date"
        value={null}
        onChange={() => {}}
        onCommit={onCommit}
        weekStart="mon"
      />,
    );

    const day = screen.getByRole("spinbutton", { name: "Day" });
    const month = screen.getByRole("spinbutton", { name: "Month" });
    const year = screen.getByRole("spinbutton", { name: "Year" });

    day.focus();
    act(() => {
      fireEvent.keyDown(day, { key: "3" });
      fireEvent.keyDown(day, { key: "1" });

      month.focus();
      fireEvent.keyDown(month, { key: "0" });
      fireEvent.keyDown(month, { key: "2" });

      year.focus();
      fireEvent.keyDown(year, { key: "2" });
      fireEvent.keyDown(year, { key: "0" });
      fireEvent.keyDown(year, { key: "2" });
      fireEvent.keyDown(year, { key: "6" });

      fireEvent.keyDown(year, { key: "Enter" });
    });

    expect(onCommit).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Enter a real date, like 03/11/2026.");
  });

  it("Escape calls onCancel", () => {
    const onCancel = vi.fn();

    render(
      <DateField
        label="Pick date"
        value={null}
        onChange={() => {}}
        onCancel={onCancel}
        weekStart="mon"
      />,
    );

    const day = screen.getByRole("spinbutton", { name: "Day" });
    day.focus();
    act(() => {
      fireEvent.keyDown(day, { key: "Escape" });
    });

    expect(onCancel).toHaveBeenCalled();
  });

  it("the calendar button opens the grid and a click on a day commits", async () => {
    const onCommit = vi.fn();
    const onChange = vi.fn();

    render(
      <DateField
        label="Pick date"
        value="2026-10-23"
        onChange={onChange}
        onCommit={onCommit}
        weekStart="mon"
      />,
    );

    const calBtn = screen.getByRole("button", { name: "Choose a date" });
    await userEvent.click(calBtn);

    const cell15 = screen.getByRole("gridcell", { name: "15" });
    await userEvent.click(cell15);

    expect(onChange).toHaveBeenCalledWith("2026-10-15");
    expect(onCommit).toHaveBeenCalledWith("2026-10-15");
  });

  it("onLeave fires when focus leaves the field, not when moving between segments or into the open calendar", async () => {
    const onLeave = vi.fn();

    render(
      <div>
        <button type="button">Outside Before</button>
        <DateField
          label="Pick date"
          value={null}
          onChange={() => {}}
          onLeave={onLeave}
          weekStart="mon"
        />
        <button type="button">Outside After</button>
      </div>,
    );

    const day = screen.getByRole("spinbutton", { name: "Day" });
    const month = screen.getByRole("spinbutton", { name: "Month" });
    const outsideAfter = screen.getByRole("button", { name: "Outside After" });

    // Focus day segment
    day.focus();
    expect(onLeave).not.toHaveBeenCalled();

    // Moving between segments does not fire onLeave
    fireEvent.blur(day, { relatedTarget: month });
    month.focus();
    expect(onLeave).not.toHaveBeenCalled();

    // Opening the calendar does not fire onLeave
    const calBtn = screen.getByRole("button", { name: "Choose a date" });
    await userEvent.click(calBtn);
    expect(onLeave).not.toHaveBeenCalled();

    // Moving focus inside the calendar popover does not fire onLeave
    const cell15 = screen.getByRole("gridcell", { name: "15" });
    fireEvent.blur(calBtn, { relatedTarget: cell15 });
    cell15.focus();
    expect(onLeave).not.toHaveBeenCalled();

    // Close calendar by pressing Escape
    fireEvent.keyDown(cell15, { key: "Escape" });

    // Focus leaving the field entirely fires onLeave
    outsideAfter.focus();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("is axe clean in both themes", async () => {
    const { container } = render(
      <main>
        <DateField
          label="Pick date"
          value="2026-10-23"
          onChange={() => {}}
          weekStart="mon"
        />
      </main>,
    );

    await expectAxeCleanInBothThemes(container);
  });
});
