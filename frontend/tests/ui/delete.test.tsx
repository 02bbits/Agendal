import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeleteTask, TaskDetails, useTaskStore } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { setup } from "./harness";

function Screen({ id }: { id: string }) {
  const store = useTaskStore();
  const [onDetails, setOnDetails] = useState(true);
  const current = store.tasks.find((x) => x.id === id);
  if (!onDetails || !current)
    return (
      <h1
        tabIndex={-1}
      >{`List: ${store.tasks.map((x) => x.title).join(", ")}`}</h1>
    );
  return (
    <TaskDetails
      task={current}
      onBack={() => setOnDetails(false)}
      deleteAction={
        <DeleteTask task={current} onDeleted={() => setOnDetails(false)} />
      }
    />
  );
}

describe("Delete a task (TK-5)", () => {
  it("leaves the screen only after the dialog took its history entry off", async () => {
    const t0 = task({ title: "Pay phone bill" });
    const { wrap } = setup([t0]);
    const historyBack = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => {});
    const onDeleted = vi.fn();
    render(wrap(<DeleteTask task={t0} onDeleted={onDeleted} />));

    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(historyBack).toHaveBeenCalled();
    expect(historyBack.mock.invocationCallOrder[0]!).toBeLessThan(
      onDeleted.mock.invocationCallOrder[0]!,
    );
    historyBack.mockRestore();
  });

  it("asks first, with a red Delete and focus on Cancel (T-TK-40)", async () => {
    const t0 = task({ title: "Pay phone bill" });
    const { wrap, memory } = setup([t0]);
    render(wrap(<Screen id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete “Pay phone bill”?",
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain(
      "bg-danger-tint",
    );
    await expectAxeCleanInBothThemes();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog.isConnected).toBe(false);
    expect(memory.db.tasks).toHaveLength(1);
  });

  it("dismisses the confirmation dialog when clicking outside on the backdrop", async () => {
    const t0 = task({ title: "Pay phone bill" });
    const { wrap, memory } = setup([t0]);
    render(wrap(<Screen id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete “Pay phone bill”?",
    });
    expect(dialog).toBeTruthy();

    const backdrop = dialog.parentElement as HTMLElement;
    await userEvent.click(backdrop);
    expect(dialog.isConnected).toBe(false);
    expect(memory.db.tasks).toHaveLength(1);
  });

  it("deletes, goes back, and Undo restores it (T-TK-41)", async () => {
    const t0 = task({ title: "Pay phone bill" });
    const keep = task({ title: "Email the group" });
    const { wrap, memory } = setup([t0, keep]);
    render(wrap(<Screen id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      screen.getByRole("heading", { name: "List: Email the group" }),
    ).toBeTruthy();
    expect(screen.getByText("Deleted “Pay phone bill”")).toBeTruthy();
    await waitFor(() =>
      expect(memory.db.tasks.map((x) => x.title)).toEqual(["Email the group"]),
    );

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(memory.db.tasks.map((x) => x.title).sort()).toEqual([
        "Email the group",
        "Pay phone bill",
      ]),
    );
    expect(
      screen.getByRole("heading", {
        name: "List: Email the group, Pay phone bill",
      }),
    ).toBeTruthy();
  });

  it("puts the row back and offers Retry when the delete fails", async () => {
    const t0 = task({ title: "Pay phone bill" });
    const { wrap, memory } = setup([t0]);
    render(wrap(<Screen id={t0.id} />));
    memory.fail();
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByText("Couldn't save that change.");
    expect(
      screen.getByRole("heading", { name: "List: Pay phone bill" }),
    ).toBeTruthy();
  });

  it("uses the scope dialog for a repeating task", async () => {
    const t0 = task({
      title: "Plan the week",
      due_date: "2026-10-25",
      repeat: "weekly",
    });
    const { wrap } = setup([t0]);
    render(wrap(<Screen id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete a repeating task" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Delete all repeating tasks" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });

  it("deleting repeating task with checkbox unchecked calls api with scope 'one', and checked calls 'future'", async () => {
    const t0 = task({
      title: "Weekly sync",
      due_date: "2026-10-25",
      repeat: "weekly",
    });
    const { wrap, memory } = setup([t0]);
    const removeSpy = vi.spyOn(memory.api, "remove");
    render(wrap(<Screen id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(removeSpy).toHaveBeenCalledWith(t0.id, "one");
    await waitFor(() => expect(memory.db.tasks).toHaveLength(0));

    const t1 = task({
      title: "Daily sync",
      due_date: "2026-10-25",
      repeat: "daily",
    });
    const { wrap: wrap2, memory: memory2 } = setup([t1]);
    const removeSpy2 = vi.spyOn(memory2.api, "remove");
    render(wrap2(<Screen id={t1.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Delete all repeating tasks" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(removeSpy2).toHaveBeenCalledWith(t1.id, "future");
  });

  it("A11Y-42: the repeat scope dialog is an alertdialog with focus on Cancel", async () => {
    const t0 = task({
      title: "Plan the week",
      due_date: "2026-10-25",
      repeat: "weekly",
    });
    const { wrap } = setup([t0]);
    render(wrap(<Screen id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Delete a repeating task",
    });
    expect(dialog).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });

  it('T-TK-105: delete with "This task only" inserts the returned next row, and Undo removes it and brings the old row back', async () => {
    const t0 = task({
      id: "t-0",
      title: "Weekly standup",
      due_date: "2026-10-25",
      repeat: "weekly",
    });
    const nextTask = task({
      id: "t-next",
      title: "Weekly standup next",
      due_date: "2026-11-01",
      repeat: "weekly",
    });
    const { wrap, memory } = setup([t0]);

    vi.spyOn(memory.api, "remove").mockResolvedValueOnce({ next: nextTask });
    vi.spyOn(memory.api, "restore").mockResolvedValueOnce(t0);

    render(wrap(<Screen id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByRole("heading", {
        name: "List: Weekly standup next",
      }),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(
      await screen.findByRole("heading", {
        name: "List: Weekly standup",
      }),
    ).toBeTruthy();
  });

  it("deleting all repeating tasks removes the entire series and Undo restores all of them", async () => {
    const tDone = task({
      id: "t-done",
      title: "Daily done",
      due_date: "2026-10-24",
      repeat: "daily",
      done: true,
    });
    const tOpen = task({
      id: "t-open",
      title: "Daily open",
      due_date: "2026-10-25",
      repeat: "daily",
      done: false,
      previous_occurrence_id: "t-done",
    });
    const { wrap, memory } = setup([tDone, tOpen]);

    vi.spyOn(memory.api, "remove").mockResolvedValueOnce({
      deleted_ids: ["t-done", "t-open"],
    });
    const restoreSpy = vi
      .spyOn(memory.api, "restore")
      .mockImplementation(async (id) => (id === "t-done" ? tDone : tOpen));

    render(wrap(<Screen id={tOpen.id} />));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Delete all repeating tasks" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const listAfterDelete = screen.getByRole("heading", { level: 1 });
    expect(listAfterDelete.textContent).not.toContain("Daily done");
    expect(listAfterDelete.textContent).not.toContain("Daily open");

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(restoreSpy).toHaveBeenCalledWith("t-done");
    expect(restoreSpy).toHaveBeenCalledWith("t-open");
    const listHeading = await screen.findByRole("heading", {
      name: /Daily done/,
    });
    expect(listHeading.textContent).toContain("Daily open");
  });
});
