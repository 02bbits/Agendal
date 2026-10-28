import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  RepeatScopeDialog,
  nextDueDate,
  nextOccurrence,
  useTaskStore,
  uuidv7,
  type Repeat,
  type Task,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

describe("nextDueDate (TK §2.3, T-TK-30)", () => {
  const cases: Array<[Exclude<Repeat, "never">, string, string]> = [
    ["daily", "2026-10-23", "2026-10-24"],
    ["weekly", "2026-10-23", "2026-10-30"],
    ["monthly", "2026-10-23", "2026-11-23"],
    ["yearly", "2026-10-23", "2027-10-23"],
  ];
  it.each(cases)("%s from %s → %s", (repeat, due, next) => {
    expect(nextDueDate(due, repeat, TODAY)).toBe(next);
  });

  it("caps a monthly anchor on the 31st and returns to it (TK-E1, T-TK-101)", () => {
    expect(nextDueDate("2027-01-31", "monthly", "2027-01-31")).toBe(
      "2027-02-28",
    );
    expect(
      nextDueDate("2027-02-28", "monthly", "2027-02-28", "2027-01-31"),
    ).toBe("2027-03-31");
  });

  it("skips missed occurrences: a daily task done 3 days late comes back today (TK-E2, T-TK-102)", () => {
    expect(nextDueDate("2026-10-20", "daily", TODAY)).toBe(TODAY);
  });

  it("counts from the due date, not the completion date (TK-E3, T-TK-103)", () => {
    // Due Friday 30 Oct, completed early on Friday 23 Oct → the following Friday
    expect(nextDueDate("2026-10-30", "weekly", TODAY)).toBe("2026-11-06");
  });

  it("skips missed weeks but lands on or after today", () => {
    expect(nextDueDate("2026-10-09", "weekly", TODAY)).toBe("2026-10-23");
    expect(nextDueDate("2026-10-08", "weekly", TODAY)).toBe("2026-10-29");
  });

  it("keeps 29 February for leap years only (TK-E15, T-TK-115)", () => {
    expect(nextDueDate("2028-02-29", "yearly", "2028-02-29")).toBe(
      "2029-02-28",
    );
    expect(
      nextDueDate("2031-02-28", "yearly", "2031-02-28", "2028-02-29"),
    ).toBe("2032-02-29");
  });

  it("copies the right fields into the next occurrence", () => {
    const t0 = task({
      title: "Plan the week",
      due_date: "2026-10-25",
      start_time: "19:00",
      reminder: "15m",
      repeat: "weekly",
      priority: "medium",
      notes: "n",
      project_id: "p-pers",
    });
    const next = nextOccurrence(
      { ...t0, done: true, done_at: "x" },
      TODAY,
      "new-id",
      "now",
    )!;
    expect(next).toMatchObject({
      id: "new-id",
      title: "Plan the week",
      due_date: "2026-11-01",
      start_time: "19:00",
      reminder: "15m",
      repeat: "weekly",
      priority: "medium",
      notes: "n",
      project_id: "p-pers",
      done: false,
      done_at: null,
      repeat_anchor: "2026-10-25",
      previous_occurrence_id: t0.id,
    });
  });

  it("makes UUID v7 ids", () => {
    expect(uuidv7(0x0189_0000_0000)).toMatch(
      /^01890000-0000-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

function Harness({ id }: { id: string }) {
  const store = useTaskStore();
  const [asking, setAsking] = useState(false);
  const current = store.tasks.find((x) => x.id === id);
  return (
    <>
      <ul>
        {store.tasks.map((x) => (
          <li
            key={x.id}
          >{`${x.title} ${x.due_date} ${x.done ? "done" : "open"}`}</li>
        ))}
      </ul>
      {current && (
        <>
          <button type="button" onClick={() => store.toggle(current)}>
            toggle
          </button>
          <button type="button" onClick={() => setAsking(true)}>
            delete
          </button>
        </>
      )}
      <RepeatScopeDialog
        open={asking}
        onCancel={() => setAsking(false)}
        onChoose={(scope) => {
          setAsking(false);
          if (current) store.remove(current, scope);
        }}
      />
    </>
  );
}

const weekly = (): Task =>
  task({ title: "Plan the week", due_date: "2026-10-25", repeat: "weekly" });

describe("Repeating tasks (TK-4)", () => {
  it("completing creates the next occurrence once (T-TK-30)", async () => {
    const t0 = weekly();
    const { wrap, memory } = setup([t0]);
    render(wrap(<Harness id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    await screen.findByText("Plan the week 2026-11-01 open");
    expect(memory.db.tasks).toHaveLength(2);
  });

  it("Undo from the toast reopens it and deletes the generated occurrence (TK-E6)", async () => {
    const t0 = weekly();
    const { wrap, memory } = setup([t0]);
    render(wrap(<Harness id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    await screen.findByText("Plan the week 2026-11-01 open");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(screen.queryByText("Plan the week 2026-11-01 open")).toBeNull(),
    );
    expect(memory.db.tasks).toHaveLength(1);
    expect(memory.db.tasks[0]!.done).toBe(false);
  });

  it("asks the scope with focus on Cancel (T-TK-31, A11Y-42)", async () => {
    const t0 = weekly();
    const { wrap } = setup([t0]);
    render(wrap(<Harness id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete a repeating task" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
    await expectAxeCleanInBothThemes();
  });

  it('"This task only" deletes it and creates the next one (TK-E5, T-TK-105)', async () => {
    const t0 = weekly();
    const { wrap, memory } = setup([t0]);
    render(wrap(<Harness id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    await userEvent.click(
      screen.getByRole("button", { name: "This task only" }),
    );
    await screen.findByText("Plan the week 2026-11-01 open");
    expect(screen.queryByText("Plan the week 2026-10-25 open")).toBeNull();
    expect(memory.db.tasks.map((x) => x.due_date)).toEqual(["2026-11-01"]);
  });

  it('"This and all future" deletes it and ends the series', async () => {
    const t0 = weekly();
    const { wrap, memory } = setup([t0]);
    render(wrap(<Harness id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    await userEvent.click(
      screen.getByRole("button", { name: "This and all future" }),
    );
    await waitFor(() => expect(memory.db.tasks).toHaveLength(0));
    expect(screen.queryByText(/^Plan the week 2026/)).toBeNull();
    expect(screen.getByText("Deleted “Plan the week”")).toBeTruthy();
  });

  it('Undo after "This task only" restores it and takes back the new occurrence', async () => {
    const t0 = weekly();
    const { wrap, memory } = setup([t0]);
    render(wrap(<Harness id={t0.id} />));
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
    await userEvent.click(
      screen.getByRole("button", { name: "This task only" }),
    );
    await screen.findByText("Plan the week 2026-11-01 open");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await screen.findByText("Plan the week 2026-10-25 open");
    await waitFor(() =>
      expect(memory.db.tasks.map((x) => x.due_date)).toEqual(["2026-10-25"]),
    );
    expect(screen.queryByText("Plan the week 2026-11-01 open")).toBeNull();
  });
});
