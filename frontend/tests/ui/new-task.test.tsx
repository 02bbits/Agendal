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
    const dateInput = within(sheet).getByLabelText("Pick date…");
    fireEvent.change(dateInput, { target: { value: "2026-11-12" } });
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(sentPickBody?.due_date).toBe("2026-11-12");
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
    const dateInput = within(sheet).getByLabelText("Pick date…");

    // Cancel by blurring without picking a date
    fireEvent.blur(dateInput);
    expect(radio("Due", "Today").getAttribute("aria-checked")).toBe("true");

    // Change to Tomorrow, then select Pick date… and cancel via blur
    await userEvent.click(radio("Due", "Tomorrow"));
    expect(radio("Due", "Tomorrow").getAttribute("aria-checked")).toBe("true");
    await userEvent.click(radio("Due", "Pick date…"));
    const dateInput2 = within(sheet).getByLabelText("Pick date…");
    fireEvent.blur(dateInput2);
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

  it("is axe clean in both themes", async () => {
    await renderSheet({ pathname: "/" });
    await expectAxeCleanInBothThemes();
  });
});
