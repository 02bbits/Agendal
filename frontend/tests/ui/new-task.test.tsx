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
    // The chip sets the start date; there is no due date until the user adds one (#154)
    expect(sentBody).toMatchObject({
      title: "Call mum",
      start_date: TODAY,
      priority: "medium",
    });
    expect(sentBody?.due_date).toBeUndefined();
    expect(sentBody?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("sets the start date for each chip and handles date picking (T-NC-51, #154)", async () => {
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
      await userEvent.click(radio("Start date", chipName));
      await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));

      expect(sentBody?.start_date).toBe(expectedDate);
      expect(sentBody?.due_date).toBeUndefined();
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
    await userEvent.click(radio("Start date", "Pick date…"));
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
    expect(sentPickBody?.start_date).toBe("2026-11-12");
  }, 15000);

  it("opens with initialStartDate, showing Pick date with 05/11/2026 and Add sends it as the start date (Section 7, #154)", async () => {
    let sentBody: CreateTaskBody | undefined;
    const onCreate = vi.fn(async (body: CreateTaskBody) => {
      sentBody = body;
      return {} as Task;
    });

    const { sheet } = await renderSheet({
      initialStartDate: "2026-11-05",
      onCreate,
    });
    expect(radio("Start date", "Pick date…").getAttribute("aria-checked")).toBe(
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
    expect(sentBody?.start_date).toBe("2026-11-05");
    expect(sentBody?.due_date).toBeUndefined();
  });

  it("closing without typing does not confirm discard when initialStartDate is set (Section 7)", async () => {
    const onClose = vi.fn();
    const { sheet } = await renderSheet({
      initialStartDate: "2026-11-05",
      onClose,
    });
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /discard/i })).toBeNull();
  });

  it("cancelling Pick date… keeps the previous chip selected (NC-E16)", async () => {
    const { sheet } = await renderSheet();
    // Default is Today
    expect(radio("Start date", "Today").getAttribute("aria-checked")).toBe(
      "true",
    );

    // Select Pick date…
    await userEvent.click(radio("Start date", "Pick date…"));
    expect(radio("Start date", "Pick date…").getAttribute("aria-checked")).toBe(
      "true",
    );
    const day = within(sheet).getByRole("spinbutton", { name: "Day" });

    // Cancel by blurring without picking a date
    fireEvent.blur(day);
    expect(radio("Start date", "Today").getAttribute("aria-checked")).toBe(
      "true",
    );

    // Change to Tomorrow, then select Pick date… and cancel via blur
    await userEvent.click(radio("Start date", "Tomorrow"));
    expect(radio("Start date", "Tomorrow").getAttribute("aria-checked")).toBe(
      "true",
    );
    await userEvent.click(radio("Start date", "Pick date…"));
    const day2 = within(sheet).getByRole("spinbutton", { name: "Day" });
    fireEvent.blur(day2);
    expect(radio("Start date", "Tomorrow").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("priority follows the start chip until user explicitly selects a priority", async () => {
    await renderSheet({ pathname: "/" });
    // Due Today -> Priority Medium
    expect(radio("Priority", "Medium").getAttribute("aria-checked")).toBe(
      "true",
    );

    // Due Tomorrow -> Priority Low
    await userEvent.click(radio("Start date", "Tomorrow"));
    expect(radio("Priority", "Low").getAttribute("aria-checked")).toBe("true");

    // Due Today -> Priority Medium
    await userEvent.click(radio("Start date", "Today"));
    expect(radio("Priority", "Medium").getAttribute("aria-checked")).toBe(
      "true",
    );

    // User explicitly taps High priority
    await userEvent.click(radio("Priority", "High"));
    expect(radio("Priority", "High").getAttribute("aria-checked")).toBe("true");

    // Changing due to Tomorrow should now leave priority as High
    await userEvent.click(radio("Start date", "Tomorrow"));
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

  it("start time is disabled with the No date chip", async () => {
    const { sheet } = await renderSheet({ pathname: "/" });
    await userEvent.click(radio("Start date", "No date"));
    const startTimePicker = within(sheet).getByRole("button", {
      name: "Start time",
    }) as HTMLButtonElement;
    expect(startTimePicker.disabled).toBe(true);
  });

  it("Upcoming starts tomorrow; Projects start with no date (#154)", async () => {
    await renderSheet({ pathname: "/upcoming" });
    expect(radio("Start date", "Tomorrow").getAttribute("aria-checked")).toBe(
      "true",
    );
    cleanup();
    await renderSheet({ pathname: "/projects/p1" });
    expect(radio("Start date", "No date").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("start time, an added due date and due time all go in the create body (#154)", async () => {
    let sentBody: CreateTaskBody | undefined;
    const onCreate = vi.fn(async (body: CreateTaskBody) => {
      sentBody = body;
      return {} as Task;
    });

    const currentToday = getToday();
    const { sheet } = await renderSheet({ today: currentToday, onCreate });
    await userEvent.type(within(sheet).getByLabelText("Title"), "Timed task");

    // Start: Today (the Inbox default), 09:00
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Start time" }),
    );
    await userEvent.click(screen.getByRole("option", { name: "09:00" }));

    // The due date is shown straight away, empty
    await userEvent.click(within(sheet).getByRole("button", { name: "Due" }));
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Due time" }),
    );
    await userEvent.click(screen.getByRole("option", { name: "17:00" }));

    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(sentBody).toMatchObject({
      title: "Timed task",
      start_date: currentToday,
      start_time: "09:00",
      due_date: currentToday,
      due_time: "17:00",
    });
  });

  it("a due date before the start disables Add and shows the error", async () => {
    const currentToday = getToday();
    const { sheet } = await renderSheet({ today: currentToday });
    const addButton = within(sheet).getByRole("button", {
      name: "Add",
    }) as HTMLButtonElement;
    await userEvent.type(within(sheet).getByLabelText("Title"), "Meeting");
    expect(addButton.disabled).toBe(false);

    // Start tomorrow, due today
    await userEvent.click(radio("Start date", "Tomorrow"));
    await userEvent.click(within(sheet).getByRole("button", { name: "Due" }));
    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    const errorEl = within(sheet).getByRole("alert");
    expect(errorEl.textContent).toBe("Start can't be after the due date.");
    expect(errorEl.id).toBe("new-task-dates-error");
    expect(addButton.disabled).toBe(true);
  });

  it("a repeat with No date starts today and is sent; New task has no reminder (#154)", async () => {
    let sentBody: CreateTaskBody | undefined;
    const onCreate = vi.fn(async (body: CreateTaskBody) => {
      sentBody = body;
      return {} as Task;
    });
    const { sheet } = await renderSheet({ pathname: "/projects/p1", onCreate });
    await userEvent.type(within(sheet).getByLabelText("Title"), "Standup");

    // Reminders are set in task details, not here
    expect(
      within(sheet).queryByRole("button", { name: "Reminder" }),
    ).toBeNull();

    await userEvent.click(
      within(sheet).getByRole("button", { name: "Repeat" }),
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Every weekday (Mon–Fri)" }),
    );
    expect(radio("Start date", "Today").getAttribute("aria-checked")).toBe(
      "true",
    );

    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));

    expect(sentBody).toMatchObject({
      start_date: TODAY,
      repeat: "weekly",
      repeat_rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    });
    expect(sentBody?.reminder).toBeUndefined();
  });

  it("is axe clean in both themes", async () => {
    await renderSheet({ pathname: "/" });
    await expectAxeCleanInBothThemes();
  });
});
