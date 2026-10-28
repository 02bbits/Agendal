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
import { describe, expect, it } from "vitest";
import {
  NewTaskSheet,
  defaultsFor,
  nextWeekStart,
  type NewTaskOrigin,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { TODAY, setup } from "./harness";

function Harness({ origin }: { origin: NewTaskOrigin }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        +
      </button>
      {open && (
        <NewTaskSheet open origin={origin} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

async function openSheet(origin: NewTaskOrigin = { from: "other" }) {
  const ctx = setup([]);
  render(ctx.wrap(<Harness origin={origin} />));
  await userEvent.click(screen.getByRole("button", { name: "+" }));
  return { ...ctx, sheet: screen.getByRole("dialog", { name: "New task" }) };
}

const radio = (group: string, name: string) =>
  within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", {
    name,
  });

describe("New task by hand (NC-7)", () => {
  it('needs only a title and confirms with "Added “…”" (T-NC-50, T-NC-53, TS-09)', async () => {
    const { sheet, memory } = await openSheet();
    expect(document.activeElement).toBe(within(sheet).getByLabelText("Title"));
    const add = within(sheet).getByRole("button", {
      name: "Add",
    }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    await userEvent.type(within(sheet).getByLabelText("Title"), "   ");
    expect(add.disabled).toBe(true);
    await userEvent.clear(within(sheet).getByLabelText("Title"));
    await userEvent.type(within(sheet).getByLabelText("Title"), "Call mum");
    await userEvent.click(add);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Added “Call mum”")).toBeTruthy();
    await waitFor(() => expect(memory.db.tasks).toHaveLength(1));
    expect(memory.db.tasks[0]).toMatchObject({
      title: "Call mum",
      due_date: null,
      priority: "low",
      project_id: null,
    });
    expect(memory.db.tasks[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("computes the due chips from the injected clock (T-NC-51)", async () => {
    // Friday 23 Oct: next week starts Monday 26 Oct, or Sunday 25 Oct
    expect(nextWeekStart(TODAY, "mon")).toBe("2026-10-26");
    expect(nextWeekStart(TODAY, "sun")).toBe("2026-10-25");
    expect(nextWeekStart("2026-10-26", "mon")).toBe("2026-11-02");

    const cases: Array<[string, string | null]> = [
      ["Today", TODAY],
      ["Tomorrow", "2026-10-24"],
      ["Next week", "2026-10-26"],
      ["No date", null],
    ];
    for (const [chip, expected] of cases) {
      const { sheet, memory } = await openSheet();
      await userEvent.type(within(sheet).getByLabelText("Title"), chip);
      await userEvent.click(radio("Due", chip));
      await userEvent.keyboard("{Control>}{Enter}{/Control}");
      await waitFor(() => expect(memory.db.tasks[0]?.due_date).toBe(expected));
      cleanup();
    }
  });

  it("picks a date with the native date input", async () => {
    const { sheet, memory } = await openSheet();
    await userEvent.type(within(sheet).getByLabelText("Title"), "Dentist");
    await userEvent.click(radio("Due", "Pick date…"));
    fireEvent.change(within(sheet).getByLabelText("Pick date…"), {
      target: { value: "2026-11-12" },
    });
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(memory.db.tasks[0]?.due_date).toBe("2026-11-12"),
    );
  });

  it("sets priority and project", async () => {
    const { sheet, memory } = await openSheet();
    await userEvent.type(within(sheet).getByLabelText("Title"), "SQL quiz");
    await userEvent.click(radio("Priority", "High"));
    await userEvent.selectOptions(
      within(sheet).getByLabelText("Project"),
      "SQL Course",
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(memory.db.tasks[0]).toMatchObject({
        priority: "high",
        project_id: "p-sql",
      }),
    );
  });

  it("defaults by where it opened (T-NC-52)", async () => {
    expect(defaultsFor({ from: "inbox" })).toEqual({
      due: "today",
      projectId: null,
    });
    expect(defaultsFor({ from: "upcoming" })).toEqual({
      due: "tomorrow",
      projectId: null,
    });
    expect(defaultsFor({ from: "project", projectId: "p-hci" })).toEqual({
      due: "none",
      projectId: "p-hci",
    });
    expect(defaultsFor({ from: "other" })).toEqual({
      due: "none",
      projectId: null,
    });

    const { sheet } = await openSheet({ from: "project", projectId: "p-hci" });
    expect(radio("Due", "No date").getAttribute("aria-checked")).toBe("true");
    expect(
      (within(sheet).getByLabelText("Project") as HTMLSelectElement).value,
    ).toBe("p-hci");
  });

  it("is axe clean in both themes", async () => {
    await openSheet({ from: "inbox" });
    await expectAxeCleanInBothThemes();
  });
});
