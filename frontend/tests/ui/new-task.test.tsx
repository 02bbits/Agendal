import { Dialog } from "../../src/ui/components/Dialog";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../src/lib/apiError";
import { today as getToday } from "../../src/lib/clock";
import type { Task } from "../../src/ui/domain/types";
import type { CreateTaskBody } from "../../src/ui/domain/newTask";
import { NewTaskSheet, type NewTaskSheetProps } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { TODAY, projects } from "./fixtures";

function Harness(props: Partial<NewTaskSheetProps>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        +
      </button>
      {open && (
        <NewTaskSheet
          open={open}
          today={TODAY}
          projects={projects}
          onClose={() => setOpen(false)}
          {...props}
        />
      )}
    </>
  );
}

async function renderSheet(props: Partial<NewTaskSheetProps> = {}) {
  render(<Harness {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "+" }));
  const sheet = screen.getByRole("dialog", { name: "New task" });
  return { sheet };
}

const radio = (group: string, name: string) =>
  within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", {
    name,
  });

describe("NewTaskSheet (T-NC-50, T-NC-51, T-NC-53)", () => {
  it("needs only a title, Add is disabled for empty or spaces, and submits valid body (T-NC-50)", async () => {
    let sentBody: CreateTaskBody | undefined;
    const onCreate = vi.fn(async (body: CreateTaskBody) => {
      sentBody = body;
      return {} as Task;
    });

    const { sheet } = await renderSheet({ pathname: "/", onCreate });
    const titleInput = within(sheet).getByLabelText("Title");
    const addButton = within(sheet).getByRole("button", {
      name: "Add",
    }) as HTMLButtonElement;

    // Disabled initially
    expect(addButton.disabled).toBe(true);

    // Disabled for spaces only (NC-E15)
    await userEvent.type(titleInput, "     ");
    expect(addButton.disabled).toBe(true);

    // Type a valid title
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Call mum");
    expect(addButton.disabled).toBe(false);

    await userEvent.click(addButton);

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(sentBody).toMatchObject({
      title: "Call mum",
      due_date: TODAY,
      priority: "medium",
    });
    expect(sentBody?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("sets correct due_date for each chip and handles date picking (T-NC-51)", async () => {
    const cases: Array<[string, string | undefined]> = [
      ["Today", TODAY],
      ["Tomorrow", "2026-10-24"],
      ["Next week", "2026-10-26"],
      ["No date", undefined],
    ];

    for (const [chipName, expectedDate] of cases) {
      let sentBody: CreateTaskBody | undefined;
      const onCreate = vi.fn(async (body: CreateTaskBody) => {
        sentBody = body;
        return {} as Task;
      });

      const { sheet } = await renderSheet({ onCreate });
      await userEvent.type(within(sheet).getByLabelText("Title"), "Task");
      await userEvent.click(radio("Due", chipName));
      await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));

      expect(sentBody?.due_date).toBe(expectedDate);
      cleanup();
    }

    // Pick date
    let sentPickBody: CreateTaskBody | undefined;
    const onCreatePick = vi.fn(async (body: CreateTaskBody) => {
      sentPickBody = body;
      return {} as Task;
    });
    const { sheet } = await renderSheet({ onCreate: onCreatePick });
    await userEvent.type(within(sheet).getByLabelText("Title"), "Dentist");
    await userEvent.click(radio("Due", "Pick date…"));
    const day = within(sheet).getByRole("spinbutton", { name: "Day" });
    const month = within(sheet).getByRole("spinbutton", { name: "Month" });
    const year = within(sheet).getByRole("spinbutton", { name: "Year" });
    day.focus();
    fireEvent.keyDown(day, { key: "1" });
    fireEvent.keyDown(day, { key: "2" });
    fireEvent.keyDown(month, { key: "1" });
    fireEvent.keyDown(month, { key: "1" });
    fireEvent.keyDown(year, { key: "2" });
    fireEvent.keyDown(year, { key: "0" });
    fireEvent.keyDown(year, { key: "2" });
    fireEvent.keyDown(year, { key: "6" });
    fireEvent.keyDown(year, { key: "Enter" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(sentPickBody?.due_date).toBe("2026-11-12");
  }, 15000);

  it("opens with initialDueDate, showing Pick date with 05/11/2026 and Add sends due_date (Section 7)", async () => {
    let sentBody: CreateTaskBody | undefined;
    const onCreate = vi.fn(async (body: CreateTaskBody) => {
      sentBody = body;
      return {} as Task;
    });

    const { sheet } = await renderSheet({
      initialDueDate: "2026-11-05",
      onCreate,
    });
    expect(radio("Due", "Pick date…").getAttribute("aria-checked")).toBe(
      "true",
    );

    const day = within(sheet).getByRole("spinbutton", { name: "Day" });
    const month = within(sheet).getByRole("spinbutton", { name: "Month" });
    const year = within(sheet).getByRole("spinbutton", { name: "Year" });
    expect(day.textContent).toBe("05");
    expect(month.textContent).toBe("11");
    expect(year.textContent).toBe("2026");

    await userEvent.type(within(sheet).getByLabelText("Title"), "Meet friend");
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(sentBody?.due_date).toBe("2026-11-05");
  });

  it("closing without typing does not confirm discard when initialDueDate is set (Section 7)", async () => {
    const onClose = vi.fn();
    const { sheet } = await renderSheet({
      initialDueDate: "2026-11-05",
      onClose,
    });
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /discard/i })).toBeNull();
  });

  it("cancelling Pick date… keeps the previous chip selected (NC-E16)", async () => {
    const { sheet } = await renderSheet();
    // Default is Today
    expect(radio("Due", "Today").getAttribute("aria-checked")).toBe("true");

    // Select Pick date…
    await userEvent.click(radio("Due", "Pick date…"));
    expect(radio("Due", "Pick date…").getAttribute("aria-checked")).toBe(
      "true",
    );
    const day = within(sheet).getByRole("spinbutton", { name: "Day" });

    // Cancel by blurring without picking a date
    fireEvent.blur(day);
    expect(radio("Due", "Today").getAttribute("aria-checked")).toBe("true");

    // Change to Tomorrow, then select Pick date… and cancel via blur
    await userEvent.click(radio("Due", "Tomorrow"));
    expect(radio("Due", "Tomorrow").getAttribute("aria-checked")).toBe("true");
    await userEvent.click(radio("Due", "Pick date…"));
    const day2 = within(sheet).getByRole("spinbutton", { name: "Day" });
    fireEvent.blur(day2);
    expect(radio("Due", "Tomorrow").getAttribute("aria-checked")).toBe("true");
  });

  it("priority follows due chip until user explicitly selects a priority", async () => {
    await renderSheet({ pathname: "/" });
    // Due Today -> Priority Medium
    expect(radio("Priority", "Medium").getAttribute("aria-checked")).toBe(
      "true",
    );

    // Due Tomorrow -> Priority Low
    await userEvent.click(radio("Due", "Tomorrow"));
    expect(radio("Priority", "Low").getAttribute("aria-checked")).toBe("true");

    // Due Today -> Priority Medium
    await userEvent.click(radio("Due", "Today"));
    expect(radio("Priority", "Medium").getAttribute("aria-checked")).toBe(
      "true",
    );

    // User explicitly taps High priority
    await userEvent.click(radio("Priority", "High"));
    expect(radio("Priority", "High").getAttribute("aria-checked")).toBe("true");

    // Changing due to Tomorrow should now leave priority as High
    await userEvent.click(radio("Due", "Tomorrow"));
    expect(radio("Priority", "High").getAttribute("aria-checked")).toBe("true");
  });

  it("notifies onAdded, submits on Enter, handles 422, task.limit, and discard dialog (T-NC-53)", async () => {
    const onAdded = vi.fn();
    let attempt = 0;
    let firstId: string | undefined;
    let secondId: string | undefined;

    const onCreate = vi.fn(async (body: CreateTaskBody) => {
      attempt += 1;
      if (attempt === 1) {
        firstId = body.id;
        throw new ApiRequestError(
          "validation_failed",
          422,
          "req-1",
          undefined,
          { title: ["Title is too short"] },
        );
      }
      secondId = body.id;
      return {} as Task;
    });

    const { sheet } = await renderSheet({ onCreate, onAdded });
    const titleInput = within(sheet).getByLabelText("Title");

    // Type title and press Enter
    await userEvent.type(titleInput, "Buy milk{Enter}");

    // First attempt failed with 422 field error
    await waitFor(() => {
      expect(within(sheet).getByText("Title is too short")).toBeTruthy();
    });

    // Retry via Add button: id stays the same (idempotent)
    const addButton = within(sheet).getByRole("button", { name: "Add" });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(attempt).toBe(2);
      expect(firstId).toBe(secondId);
      expect(onAdded).toHaveBeenCalledWith("Buy milk");
      expect(screen.queryByRole("dialog", { name: "New task" })).toBeNull();
    });
  });

  it("shows task.limit error message when server returns task.limit", async () => {
    const onCreate = vi.fn(async () => {
      throw new ApiRequestError("task.limit", 400);
    });

    const { sheet } = await renderSheet({ onCreate });
    await userEvent.type(within(sheet).getByLabelText("Title"), "Test task");
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(
        within(sheet).getByText(
          "You've reached 5,000 open tasks. Complete or delete some to add more.",
        ),
      ).toBeTruthy();
    });
  });

  it("Esc closes the top layer even when focus fell to the page", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Discard changes?" onClose={onClose} actions={null} />,
    );
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the discard dialog stacks above the sheet, not behind it", () => {
    render(
      <Dialog
        open
        title="Discard changes?"
        onClose={() => {}}
        actions={null}
      />,
    );
    const layer = screen.getByRole("alertdialog").parentElement!;
    expect(layer.className).toContain("z-[1000]");
  });

  it("shows discard dialog on close with input, closes immediately with no input", async () => {
    // No input: closes immediately
    const { sheet: sheet1 } = await renderSheet();
    await userEvent.click(
      within(sheet1).getByRole("button", { name: "Close" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    cleanup();

    // With input: prompts discard dialog
    const { sheet: sheet2 } = await renderSheet();
    await userEvent.type(within(sheet2).getByLabelText("Title"), "Draft task");
    await userEvent.click(
      within(sheet2).getByRole("button", { name: "Close" }),
    );

    // Discard dialog is open
    const dialog = screen.getByRole("alertdialog", {
      name: "Discard changes?",
    });
    expect(dialog).toBeTruthy();

    // Click Keep editing: returns to sheet
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "New task" })).toBeTruthy();

    // Click Close again and Discard: closes sheet
    await userEvent.click(
      within(sheet2).getByRole("button", { name: "Close" }),
    );
    const dialog2 = screen.getByRole("alertdialog", {
      name: "Discard changes?",
    });
    await userEvent.click(
      within(dialog2).getByRole("button", { name: "Discard" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("due time disabled with the No date chip", async () => {
    const { sheet } = await renderSheet({ pathname: "/" });
    await userEvent.click(radio("Due", "No date"));
    const dueTimePicker = within(sheet).getByRole("button", {
      name: "Due time",
    }) as HTMLButtonElement;
    expect(dueTimePicker.disabled).toBe(true);
  });

  it("choosing start date + start time + due time sends start_date, start_time, due_date, due_time in the create body", async () => {
    let sentBody: CreateTaskBody | undefined;
    const onCreate = vi.fn(async (body: CreateTaskBody) => {
      sentBody = body;
      return {} as Task;
    });

    const currentToday = getToday();
    const { sheet } = await renderSheet({ today: currentToday, onCreate });
    await userEvent.type(within(sheet).getByLabelText("Title"), "Timed task");

    // Due time
    const dueTimePicker = within(sheet).getByRole("button", {
      name: "Due time",
    });
    await userEvent.click(dueTimePicker);
    await userEvent.click(screen.getByRole("option", { name: "17:00" }));

    // Start date
    const startDatePicker = within(sheet).getByRole("button", {
      name: "Start date",
    });
    await userEvent.click(startDatePicker);
    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    // Start time
    const startTimePicker = within(sheet).getByRole("button", {
      name: "Start",
    });
    await userEvent.click(startTimePicker);
    await userEvent.click(screen.getByRole("option", { name: "09:00" }));

    // Add task
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(sentBody).toMatchObject({
      title: "Timed task",
      due_date: currentToday,
      due_time: "17:00",
      start_date: currentToday,
      start_time: "09:00",
    });
  });

  it("start after due disables Add and shows the error", async () => {
    const currentToday = getToday();
    const { sheet } = await renderSheet({ today: currentToday });
    const addButton = within(sheet).getByRole("button", {
      name: "Add",
    }) as HTMLButtonElement;
    await userEvent.type(within(sheet).getByLabelText("Title"), "Meeting");
    expect(addButton.disabled).toBe(false);

    // Pick Start date as Tomorrow while Due is Today
    const startDatePicker = within(sheet).getByRole("button", {
      name: "Start date",
    });
    await userEvent.click(startDatePicker);
    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));

    // Error is displayed and Add is disabled
    const errorEl = within(sheet).getByRole("alert");
    expect(errorEl.textContent).toBe("Start can't be after the due date.");
    expect(errorEl.id).toBe("new-task-dates-error");
    expect(addButton.disabled).toBe(true);
  });

  it("is axe clean in both themes", async () => {
    await renderSheet({ pathname: "/" });
    await expectAxeCleanInBothThemes();
  });
});
