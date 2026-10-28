import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  PRIORITIES,
  REMINDERS,
  REPEATS,
  TaskDetails,
  normalizePatch,
  reminderAt,
  scheduleError,
  t,
  useTaskStore,
  type CopyKey,
  type Task,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

function Details({ id }: { id: string }) {
  const store = useTaskStore();
  const current = store.tasks.find((x) => x.id === id)!;
  return (
    <TaskDetails
      task={current}
      onBack={() => {}}
      sourceNote={{ name: "This week", href: "/notes/n1" }}
    />
  );
}

function open(t0: Task) {
  const ctx = setup([t0]);
  render(ctx.wrap(<Details id={t0.id} />));
  const saved = () => ctx.memory.db.tasks.find((x) => x.id === t0.id)!;
  return { ...ctx, saved };
}

const row = (name: RegExp) => screen.getByRole("button", { name });

describe("field rules (TK §2.2)", () => {
  const base = task({ title: "Base" });

  it("sets the due date to today when a start or a repeat is set without one", () => {
    expect(normalizePatch(base, { start_time: "09:00" }, TODAY)).toEqual({
      start_time: "09:00",
      due_date: TODAY,
    });
    expect(normalizePatch(base, { repeat: "weekly" }, TODAY)).toEqual({
      repeat: "weekly",
      due_date: TODAY,
    });
  });

  it("clearing the start clears the end; clearing the date clears start, end and reminder", () => {
    const timed = task({
      title: "x",
      due_date: TODAY,
      start_time: "09:00",
      end_time: "10:00",
      reminder: "15m",
    });
    expect(normalizePatch(timed, { start_time: null }, TODAY)).toEqual({
      start_time: null,
      end_time: null,
    });
    expect(normalizePatch(timed, { due_date: null }, TODAY)).toEqual({
      due_date: null,
      start_time: null,
      end_time: null,
      reminder: "none",
    });
  });

  it("sends nothing when a field is set to its current value (TK-E16)", () => {
    expect(
      normalizePatch(task({ title: "Same" }), { title: " Same " }, TODAY),
    ).toEqual({});
  });

  it("rejects an end not after the start (T-TK-20)", () => {
    expect(scheduleError("16:00", "15:00")).toBe("task.end_before_start");
    expect(scheduleError("16:00", "16:00")).toBe("task.end_before_start");
    expect(scheduleError("16:00", "17:00")).toBeNull();
    expect(scheduleError("16:00", null)).toBeNull();
  });

  it("times reminders from the start, or 09:00 on the due date (BR-12)", () => {
    expect(
      reminderAt({ due_date: TODAY, start_time: "16:00", reminder: "15m" }),
    ).toBe("2026-10-23T15:45");
    expect(
      reminderAt({ due_date: TODAY, start_time: null, reminder: "1h" }),
    ).toBe("2026-10-23T08:00");
    expect(
      reminderAt({ due_date: TODAY, start_time: "00:10", reminder: "1d" }),
    ).toBe("2026-10-22T00:10");
    expect(
      reminderAt({ due_date: null, start_time: null, reminder: "5m" }),
    ).toBeNull();
  });
});

describe("Task details (TK-2, T-TK-10)", () => {
  it("edits the title on blur and refuses an empty one", async () => {
    const { saved } = open(task({ title: "Email the group", due_date: TODAY }));
    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Email the HCI group");
    fireEvent.blur(title);
    await waitFor(() => expect(saved().title).toBe("Email the HCI group"));

    await userEvent.clear(title);
    fireEvent.blur(title);
    expect(screen.getByRole("alert").textContent).toBe("A task needs a title.");
    expect((title as HTMLTextAreaElement).value).toBe("Email the HCI group");
  });

  it("sets and clears the due date, with Undo for the cleared fields", async () => {
    const { saved } = open(
      task({
        title: "x",
        due_date: TODAY,
        start_time: "20:00",
        reminder: "15m",
      }),
    );
    await userEvent.click(row(/^Due/));
    const dialog = screen.getByRole("dialog", { name: "Due" });
    fireEvent.change(within(dialog).getByLabelText("Due"), {
      target: { value: "2026-10-26" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(saved().due_date).toBe("2026-10-26"));

    await userEvent.click(row(/^Due/));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }),
    );
    await waitFor(() =>
      expect(saved()).toMatchObject({
        due_date: null,
        start_time: null,
        reminder: "none",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(saved()).toMatchObject({
        due_date: "2026-10-26",
        start_time: "20:00",
        reminder: "15m",
      }),
    );
  });

  it("sets a schedule and shows the end-before-start error without saving (T-TK-20)", async () => {
    const { saved } = open(task({ title: "Plan", due_date: TODAY }));
    await userEvent.click(row(/^Schedule/));
    const dialog = screen.getByRole("dialog", { name: "Schedule" });
    expect(
      (within(dialog).getByLabelText("End") as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Start"), {
      target: { value: "16:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("End"), {
      target: { value: "15:00" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    const end = within(dialog).getByLabelText("End");
    expect(end.getAttribute("aria-invalid")).toBe("true");
    expect(
      within(dialog).getByText("End time must be later than the start time."),
    ).toBeTruthy();
    expect(saved().start_time).toBeNull();

    fireEvent.change(end, { target: { value: "17:00" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(saved()).toMatchObject({ start_time: "16:00", end_time: "17:00" }),
    );
    expect(row(/^Schedule/).textContent).toContain("16:00 – 17:00");
  });

  it.each(REMINDERS)("saves reminder %s", async (reminder) => {
    const { saved } = open(task({ title: "x", due_date: "2026-10-30" }));
    await userEvent.click(row(/^Reminder/));
    await userEvent.click(
      screen.getByRole("radio", { name: t(`reminder.${reminder}` as CopyKey) }),
    );
    await waitFor(() => expect(saved().reminder).toBe(reminder));
  });

  it("disables Reminder without a date and says why", () => {
    open(task({ title: "x" }));
    const reminder = row(/^Reminder/);
    expect((reminder as HTMLButtonElement).disabled).toBe(true);
    expect(
      document.getElementById(reminder.getAttribute("aria-describedby")!)!
        .textContent,
    ).toBe("Add a date to set a reminder.");
  });

  it("notes a reminder time already passed (TK-E4)", () => {
    open(
      task({
        title: "x",
        due_date: TODAY,
        start_time: "08:00",
        reminder: "15m",
      }),
    );
    expect(
      screen.getByText("This reminder time has already passed."),
    ).toBeTruthy();
  });

  it.each(REPEATS)("saves repeat %s", async (repeat) => {
    const { saved } = open(
      task({
        title: "x",
        due_date: TODAY,
        repeat: repeat === "never" ? "daily" : "never",
      }),
    );
    await userEvent.click(row(/^Repeat/));
    await userEvent.click(
      screen.getByRole("radio", { name: t(`repeat.${repeat}` as CopyKey) }),
    );
    await waitFor(() => expect(saved().repeat).toBe(repeat));
  });

  it.each(PRIORITIES)("saves priority %s", async (priority) => {
    const { saved } = open(
      task({ title: "x", priority: priority === "low" ? "high" : "low" }),
    );
    await userEvent.click(row(/^Priority/));
    await userEvent.click(
      screen.getByRole("radio", { name: t(`priority.${priority}` as CopyKey) }),
    );
    await waitFor(() => expect(saved().priority).toBe(priority));
  });

  it("moves the task to a project and back to No project", async () => {
    const { saved } = open(task({ title: "x" }));
    await userEvent.click(row(/^Project/));
    await userEvent.click(screen.getByRole("radio", { name: "HCI" }));
    await waitFor(() => expect(saved().project_id).toBe("p-hci"));
    await userEvent.click(row(/^Project/));
    await userEvent.click(screen.getByRole("radio", { name: "No project" }));
    await waitFor(() => expect(saved().project_id).toBeNull());
  });

  it("saves notes", async () => {
    const { saved } = open(task({ title: "x" }));
    await userEvent.click(row(/^Notes/));
    const dialog = screen.getByRole("dialog", { name: "Notes" });
    await userEvent.type(
      within(dialog).getByLabelText("Notes"),
      "Bring the ER diagram",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(saved().notes).toBe("Bring the ER diagram"));
  });

  it("shows the assistant tag as text with the note link (A11Y-43)", () => {
    open(task({ title: "x", created_by: "assistant" }));
    expect(screen.getByText("Created by the assistant")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "From note: This week" })
        .getAttribute("href"),
    ).toBe("/notes/n1");
  });

  it("Mark done completes the task", async () => {
    const { saved } = open(task({ title: "x", due_date: TODAY }));
    await userEvent.click(screen.getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(saved().done).toBe(true));
  });

  it("is axe clean in both themes", async () => {
    open(
      task({
        title: "Email the group",
        due_date: TODAY,
        start_time: "20:00",
        reminder: "15m",
        priority: "medium",
        created_by: "assistant",
      }),
    );
    await expectAxeCleanInBothThemes();
  });
});
