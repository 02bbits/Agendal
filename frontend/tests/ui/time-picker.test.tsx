import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClockPicker } from "../../src/ui/components/ClockPicker";
import { TimePicker } from "../../src/ui/components/TimePicker";
import { t } from "../../src/ui/copy";
import { parseTime } from "../../src/ui/domain/parseTime";
import { useWideScreen } from "./wideScreen";

afterEach(cleanup);

describe("parseTime (#154)", () => {
  it.each([
    ["9", "09:00"],
    ["09", "09:00"],
    ["930", "09:30"],
    ["0930", "09:30"],
    ["9:30", "09:30"],
    ["9.30", "09:30"],
    ["9h30", "09:30"],
    ["21h", "21:00"],
    ["2115", "21:15"],
    ["9pm", "21:00"],
    ["9:30 PM", "21:30"],
    ["12am", "00:00"],
    ["12pm", "12:00"],
    [" 7 : 05 ".replace(/ /g, ""), "07:05"],
  ])("reads %s as %s", (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });

  it.each(["", "abc", "24:00", "9:60", "13pm", "0am", "12345"])(
    "refuses %s",
    (input) => {
      expect(parseTime(input)).toBeNull();
    },
  );
});

function Harness({
  initial = "",
  minTime = null,
  onChange = () => {},
}: {
  initial?: string;
  minTime?: string | null;
  onChange?: (time: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TimePicker
      label="Start time"
      value={value}
      timeFormat="24h"
      minTime={minTime}
      onChange={(time) => {
        setValue(time);
        onChange(time);
      }}
    />
  );
}

describe("TimePicker on a wide screen: fixed HH : MM field (#154)", () => {
  const open = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Start time" }));
    return {
      hour: screen.getByRole("textbox", {
        name: t("time.hour"),
      }) as HTMLInputElement,
      minute: screen.getByRole("textbox", {
        name: t("time.minute"),
      }) as HTMLInputElement,
    };
  };

  it("opens with the current time in the two boxes, and the colon is not part of what is typed", async () => {
    useWideScreen();
    render(<Harness initial="08:30" />);
    const { hour, minute } = await open();
    expect(hour.value).toBe("08");
    expect(minute.value).toBe("30");
    expect(
      screen.getByRole("group", { name: t("time.field") }).textContent,
    ).toContain(":");
  });

  it("typing two hour digits moves on to the minutes, and Enter sets the time", async () => {
    useWideScreen();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const { hour, minute } = await open();
    await userEvent.type(hour, "09");
    expect(document.activeElement).toBe(minute);
    await userEvent.keyboard("37{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("09:37");
    expect(screen.getByRole("button", { name: "Start time" }).textContent).toBe(
      "09:37",
    );
  });

  it("only digits go in the boxes", async () => {
    useWideScreen();
    render(<Harness />);
    const { hour, minute } = await open();
    await userEvent.type(hour, "a1");
    expect(hour.value).toBe("1");
    await userEvent.type(minute, ":x5");
    expect(minute.value).toBe("5");
  });

  it("says what is wrong with a time it can't take", async () => {
    useWideScreen();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const { hour, minute } = await open();
    await userEvent.type(hour, "09");
    await userEvent.type(minute, "75{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(t("time.invalid"));
    expect(hour.getAttribute("aria-invalid")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses a time at or before the minimum (due after start, TK-3)", async () => {
    useWideScreen();
    const onChange = vi.fn();
    render(<Harness minTime="14:00" onChange={onChange} />);
    const { hour, minute } = await open();
    expect(screen.queryByRole("option", { name: "14:00" })).toBeNull();
    await userEvent.type(hour, "13");
    await userEvent.type(minute, "30{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      t("time.after", { time: "14:00" }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("typing odd minutes like 01:07 and clicking OK or outside saves 01:07", async () => {
    useWideScreen();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const { hour, minute } = await open();
    await userEvent.type(hour, "01");
    await userEvent.type(minute, "07");
    await userEvent.click(screen.getByRole("button", { name: t("common.ok") }));
    expect(onChange).toHaveBeenLastCalledWith("01:07");
    expect(screen.getByRole("button", { name: "Start time" }).textContent).toBe(
      "01:07",
    );
  });

  it("arrows walk the list and fill the boxes, and a picked time is set", async () => {
    useWideScreen();
    const onChange = vi.fn();
    render(<Harness initial="09:00" onChange={onChange} />);
    const { hour, minute } = await open();
    await userEvent.keyboard("{ArrowDown}");
    expect(`${hour.value}:${minute.value}`).toBe("09:15");
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("09:15");
    await open();
    await userEvent.click(screen.getByRole("option", { name: "10:15" }));
    expect(onChange).toHaveBeenLastCalledWith("10:15");
    expect(screen.queryByRole("group", { name: t("time.field") })).toBeNull();
  });
});

describe("ClockPicker on phones (#154)", () => {
  it("picks the hour on the dial, then the minute, and OK saves it", async () => {
    const onDone = vi.fn();
    render(
      <ClockPicker
        value="09:00"
        timeFormat="24h"
        onDone={onDone}
        onCancel={() => {}}
      />,
    );
    const dial = screen.getByRole("slider", { name: t("time.hour") });
    dial.focus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{Enter}");
    // Enter on the hour goes on to the minute
    const minutes = screen.getByRole("slider", { name: t("time.minute") });
    expect(minutes.getAttribute("aria-valuenow")).toBe("0");
    minutes.focus();
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.click(screen.getByRole("button", { name: t("common.ok") }));
    expect(onDone).toHaveBeenCalledWith("11:01");
  });

  it("the keyboard button switches to typing the time", async () => {
    const onDone = vi.fn();
    render(
      <ClockPicker
        value=""
        timeFormat="24h"
        onDone={onDone}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: t("time.keyboard") }),
    );
    const hour = screen.getByRole("textbox", { name: t("time.hour") });
    const minute = screen.getByRole("textbox", { name: t("time.minute") });
    await userEvent.clear(hour);
    await userEvent.type(hour, "1");
    await userEvent.clear(minute);
    await userEvent.type(minute, "7");
    await userEvent.click(screen.getByRole("button", { name: t("common.ok") }));
    expect(onDone).toHaveBeenCalledWith("01:07");
  });

  it("12-hour shows AM/PM and keeps the half of the day", async () => {
    const onDone = vi.fn();
    render(
      <ClockPicker
        value="09:30"
        timeFormat="12h"
        onDone={onDone}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: t("time.pm") }));
    await userEvent.click(screen.getByRole("button", { name: t("common.ok") }));
    expect(onDone).toHaveBeenCalledWith("21:30");
  });

  it("refuses a time at or before the minimum, and has no None button", async () => {
    const onDone = vi.fn();
    render(
      <ClockPicker
        value="13:00"
        timeFormat="24h"
        minTime="14:00"
        onDone={onDone}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: t("common.ok") }));
    expect(screen.getByRole("alert").textContent).toBe(
      t("time.after", { time: "14:00" }),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: t("task.not_set") }),
    ).toBeNull();
  });
});
