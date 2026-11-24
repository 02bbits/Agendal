import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t } from "@/ui/copy";
import {
  CalendarReminderControl,
  computeReminderPreview,
  formatReminderString,
  parseReminderString,
} from "@/ui/features/tasks/details/CalendarReminderControl";
import type { Task } from "@/ui/domain/types";

const mockTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t-1",
  title: "Test task",
  start_date: "2026-11-24",
  due_date: "2026-11-24",
  start_time: "09:00",
  due_time: "10:00",
  priority: "medium",
  project_id: null,
  repeat: "never",
  reminder: "none",
  due_reminder: "none",
  notes: null,
  done: false,
  done_at: null,
  created_by: "user",
  created_at: "2026-11-24T00:00:00Z",
  ...overrides,
});

describe("CalendarReminderControl (Google Calendar style)", () => {
  it("parses and formats reminder strings for arbitrary numbers and units", () => {
    expect(parseReminderString("none")).toEqual({
      value: 10,
      unit: "minutes",
    });
    expect(parseReminderString("0m")).toEqual({ value: 0, unit: "minutes" });
    expect(parseReminderString("25m")).toEqual({ value: 25, unit: "minutes" });
    expect(parseReminderString("3h")).toEqual({ value: 3, unit: "hours" });
    expect(parseReminderString("2d")).toEqual({ value: 2, unit: "days" });
    expect(parseReminderString("4w")).toEqual({ value: 4, unit: "weeks" });

    expect(formatReminderString(15, "minutes")).toBe("15m");
    expect(formatReminderString(3, "hours")).toBe("3h");
    expect(formatReminderString(5, "days")).toBe("5d");
    expect(formatReminderString(2, "weeks")).toBe("2w");
  });

  it("computes reminder preview timestamp correctly", () => {
    const preview = computeReminderPreview(
      "2026-11-24",
      "09:00",
      10,
      "minutes",
      "24h",
    );
    expect(preview).toContain("08:50");
    expect(preview).toContain("24 Nov");

    const preview12h = computeReminderPreview(
      "2026-11-24",
      "09:00",
      10,
      "minutes",
      "12h",
    );
    expect(preview12h).toContain("8:50 am");
  });

  it("shows disabled helper when task has neither start_date nor due_date", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({ start_date: null, due_date: null })}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Add a date to set a reminder.")).toBeDefined();
    expect(screen.queryByText("+ Add notification")).toBeNull();
  });

  it("adds notification with default 10 minutes when clicking '+ Add notification'", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({ reminder: "none" })}
        onSave={onSave}
      />,
    );

    const addBtn = screen
      .getByText(t("task.add_notification"))
      .closest("button")!;
    fireEvent.click(addBtn);

    expect(onSave).toHaveBeenCalledWith({ reminder: "10m" });
  });

  it("renders active reminder with stepper, unit selector, preview and remove button", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({ reminder: "10m" })}
        onSave={onSave}
      />,
    );

    // Static Notification badge is removed
    expect(screen.queryByText("Notification")).toBeNull();
    // Anchor selector has before start date
    expect(
      screen.getAllByText("before start date").length,
    ).toBeGreaterThanOrEqual(1);

    // Value input
    const input = screen.getByLabelText(t("task.reminder_value"));
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe("10");

    // Stepper buttons
    const incBtn = screen.getByRole("button", { name: "Increase" });
    fireEvent.click(incBtn);
    expect(onSave).toHaveBeenCalledWith({ reminder: "11m" });

    // Change value directly
    fireEvent.change(input, { target: { value: "45" } });
    expect(onSave).toHaveBeenCalledWith({ reminder: "45m" });

    // Change unit to hours via SelectDropdown
    const unitTrigger = screen.getByRole("button", { name: /minutes/i });
    fireEvent.click(unitTrigger);
    const hoursOption = screen.getByRole("option", { name: /hours/i });
    fireEvent.click(hoursOption);
    expect(onSave).toHaveBeenCalledWith({ reminder: "45h" });

    // Click remove button
    const removeBtn = screen.getByRole("button", { name: "Remove reminder" });
    fireEvent.click(removeBtn);
    expect(onSave).toHaveBeenCalledWith({ reminder: "none" });
  });

  it("preserves value and unit when switching anchor between start date and due date", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({
          reminder: "15h",
          due_reminder: "none",
          start_date: "2026-11-24",
          due_date: "2026-11-25",
        })}
        onSave={onSave}
      />,
    );

    // Click anchor trigger ("before start date")
    const anchorTrigger = screen.getByRole("button", {
      name: /before start date/i,
    });
    fireEvent.click(anchorTrigger);

    // Pick "before due date"
    const dueOption = screen.getByRole("option", { name: /before due date/i });
    fireEvent.click(dueOption);

    // Transferred to due_reminder with preserved 15 hours, and cleared reminder
    expect(onSave).toHaveBeenCalledWith({
      reminder: "none",
      due_reminder: "15h",
    });
  });

  it("automatically picks start date when adding a notification if due date is already active", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({
          reminder: "none",
          due_reminder: "15h",
          start_date: "2026-11-24",
          due_date: "2026-11-25",
        })}
        onSave={onSave}
      />,
    );

    const addBtn = screen
      .getByText(t("task.add_notification"))
      .closest("button")!;
    fireEvent.click(addBtn);

    // Adds start date notification without touching due_reminder
    expect(onSave).toHaveBeenCalledWith({ reminder: "10m" });
  });

  it("disables anchor dropdowns and hides '+ Add notification' button when both notifications are active", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({
          reminder: "10m",
          due_reminder: "1h",
          start_date: "2026-11-24",
          due_date: "2026-11-25",
        })}
        onSave={onSave}
      />,
    );

    // + Add notification button must be hidden when both are active
    expect(screen.queryByText("+ Add notification")).toBeNull();

    // Both anchor triggers should be disabled
    const startAnchor = screen.getByRole("button", {
      name: /before start date/i,
    });
    const dueAnchor = screen.getByRole("button", {
      name: /before due date/i,
    });

    expect(startAnchor.hasAttribute("disabled")).toBe(true);
    expect(dueAnchor.hasAttribute("disabled")).toBe(true);
  });

  it("renders disabled dropdown (not plain text) when task only has one date", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({
          reminder: "10m",
          start_date: "2026-11-24",
          due_date: null,
        })}
        onSave={onSave}
      />,
    );

    // Anchor is rendered as a disabled button/dropdown
    const anchorBtn = screen.getByRole("button", {
      name: /before start date/i,
    });
    expect(anchorBtn).toBeDefined();
    expect(anchorBtn.hasAttribute("disabled")).toBe(true);
  });

  it("defaults due date reminder time to 21:00 when due_time is null", () => {
    const onSave = vi.fn();
    render(
      <CalendarReminderControl
        task={mockTask({
          start_date: null,
          due_date: "2026-11-24",
          due_time: null,
          due_reminder: "10m",
        })}
        onSave={onSave}
      />,
    );

    // 21:00 minus 10 minutes = 20:50
    expect(screen.getByText(/20:50/)).toBeDefined();
  });

  it("keeps due date notification in first slot when adding start date notification second", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <CalendarReminderControl
        task={mockTask({
          reminder: "none",
          due_reminder: "15m",
          start_date: "2026-11-24",
          due_date: "2026-11-25",
        })}
        onSave={onSave}
      />,
    );

    // Re-render with both active (simulating user adding the start notification)
    rerender(
      <CalendarReminderControl
        task={mockTask({
          reminder: "10m",
          due_reminder: "15m",
          start_date: "2026-11-24",
          due_date: "2026-11-25",
        })}
        onSave={onSave}
      />,
    );

    const inputs = screen.getAllByLabelText(t("task.reminder_value"));
    // First slot should remain the due notification (15m), and second slot is newly added start notification (10m)
    expect((inputs[0] as HTMLInputElement).value).toBe("15");
    expect((inputs[1] as HTMLInputElement).value).toBe("10");
  });
});
