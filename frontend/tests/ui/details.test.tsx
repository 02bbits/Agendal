import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PRIORITIES,
  REMINDERS,
  REPEATS,
  TaskDetails,
  t,
  useTaskStore,
  type Task,
} from "../../src/ui";
import { DetailsFooter } from "../../src/ui/features/tasks/details/DetailsFooter";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

function Details({
  id,
  projectsStatus,
  onRetryProjects,
}: {
  id: string;
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
}) {
  const store = useTaskStore();
  const current = store.tasks.find((x) => x.id === id)!;
  return (
    <TaskDetails
      task={current}
      onBack={() => {}}
      sourceNote={{ name: "This week", href: "/notes/n1" }}
      projectsStatus={projectsStatus}
      onRetryProjects={onRetryProjects}
    />
  );
}

function open(
  t0: Task,
  opts?: { projectsStatus?: "ready" | "failed"; onRetryProjects?: () => void },
) {
  const ctx = setup([t0]);
  const patchSpy = vi.spyOn(ctx.memory.api, "patch");
  render(
    ctx.wrap(
      <Details
        id={t0.id}
        projectsStatus={opts?.projectsStatus}
        onRetryProjects={opts?.onRetryProjects}
      />,
    ),
  );
  const saved = () => ctx.memory.db.tasks.find((x) => x.id === t0.id)!;
  return { ...ctx, saved, patchSpy };
}

describe("Task details fields (T-TK-10)", () => {
  it("saves title on blur", async () => {
    const { patchSpy } = open(
      task({ title: "Original Title", due_date: TODAY }),
    );
    const input = screen.getByLabelText(t("task.title"));
    fireEvent.change(input, { target: { value: "Updated Title" } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { title: "Updated Title" },
        expect.any(String),
      ),
    );
  });

  it("saves start time", async () => {
    const { patchSpy } = open(task({ title: "Task", due_date: TODAY }));
    const input = screen.getByLabelText(t("task.start"));
    fireEvent.change(input, { target: { value: "09:00" } });
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { start_time: "09:00" },
        expect.any(String),
      ),
    );
  });

  it("saves end time", async () => {
    const { patchSpy } = open(
      task({ title: "Task", due_date: TODAY, start_time: "09:00" }),
    );
    const input = screen.getByLabelText(t("task.end"));
    fireEvent.change(input, { target: { value: "10:00" } });
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { end_time: "10:00" },
        expect.any(String),
      ),
    );
  });

  it("sets due date, and Clear clears schedule and reminder with Undo toast", async () => {
    const { patchSpy } = open(
      task({
        title: "Task",
        due_date: "2026-10-30",
        start_time: "09:00",
        end_time: "10:00",
        reminder: "15m",
      }),
    );
    const dateInput = screen.getByLabelText(t("task.due"));
    fireEvent.change(dateInput, { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { due_date: "2026-11-01" },
        expect.any(String),
      ),
    );

    const clearBtn = screen.getByRole("button", { name: t("common.clear") });
    await userEvent.click(clearBtn);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        {
          due_date: null,
          start_time: null,
          end_time: null,
          reminder: "none",
        },
        expect.any(String),
      ),
    );

    const undoBtn = screen.getByRole("button", { name: t("common.undo") });
    await userEvent.click(undoBtn);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        {
          due_date: "2026-11-01",
          start_time: "09:00",
          end_time: "10:00",
          reminder: "15m",
        },
        expect.any(String),
      ),
    );
  });

  it.each(REMINDERS)("saves reminder %s", async (reminder) => {
    const { patchSpy } = open(
      task({
        title: "Task",
        due_date: TODAY,
        reminder: reminder === "none" ? "15m" : "none",
      }),
    );
    const select = screen.getByLabelText(t("task.reminder"));
    await userEvent.selectOptions(select, reminder);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { reminder },
        expect.any(String),
      ),
    );
  });

  it.each(REPEATS)("saves repeat %s", async (repeat) => {
    const { patchSpy } = open(
      task({
        title: "Task",
        due_date: TODAY,
        repeat: repeat === "never" ? "daily" : "never",
      }),
    );
    const select = screen.getByLabelText(t("task.repeat"));
    await userEvent.selectOptions(select, repeat);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { repeat },
        expect.any(String),
      ),
    );
  });

  it.each(PRIORITIES)("saves priority %s", async (priority) => {
    const { patchSpy } = open(
      task({
        title: "Task",
        priority: priority === "low" ? "high" : "low",
      }),
    );
    const select = screen.getByLabelText(t("task.priority"));
    await userEvent.selectOptions(select, priority);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { priority },
        expect.any(String),
      ),
    );
  });

  it("moves task to a project and back to No project", async () => {
    const { patchSpy } = open(task({ title: "Task", project_id: null }));
    const select = screen.getByLabelText(t("task.project"));
    await userEvent.selectOptions(select, "p-hci");
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { project_id: "p-hci" },
        expect.any(String),
      ),
    );

    await userEvent.selectOptions(select, "");
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { project_id: null },
        expect.any(String),
      ),
    );
  });

  it("shows project name when projects are loaded and contain task's project", () => {
    open(task({ title: "Task with Project", project_id: "p-hci" }));
    const select = screen.getByLabelText(
      t("task.project"),
    ) as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(select.value).toBe("p-hci");
    expect(screen.getByText("HCI")).toBeTruthy();
  });

  it("disables select with helper and sends no patch when task has no project and projects fail", async () => {
    const { patchSpy } = open(
      task({ title: "No Project Task", project_id: null }),
      { projectsStatus: "failed" },
    );
    const select = screen.getByLabelText(
      t("task.project"),
    ) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(
      screen.getAllByText(t("project.load_failed")).length,
    ).toBeGreaterThan(0);
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("saves notes on blur", async () => {
    const { patchSpy } = open(task({ title: "Task", notes: "Old notes" }));
    const textarea = screen.getByLabelText(t("task.notes"));
    fireEvent.change(textarea, { target: { value: "New notes content" } });
    fireEvent.blur(textarea);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { notes: "New notes content" },
        expect.any(String),
      ),
    );
  });
});

describe("Schedule validation (T-TK-20)", () => {
  it("shows end_before_start linked by aria-describedby with role alert and sends no patch", async () => {
    const { patchSpy } = open(
      task({
        title: "Schedule Task",
        due_date: TODAY,
        start_time: "14:00",
        end_time: null,
      }),
    );
    const endInput = screen.getByLabelText(t("task.end"));

    // End earlier than start
    fireEvent.change(endInput, { target: { value: "13:00" } });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(t("task.end_before_start"));
    expect(endInput.getAttribute("aria-describedby")).toBe("task-end-error");
    expect(endInput.getAttribute("aria-invalid")).toBe("true");
    expect(patchSpy).not.toHaveBeenCalled();

    // End equal to start
    fireEvent.change(endInput, { target: { value: "14:00" } });
    expect(screen.getByRole("alert").textContent).toBe(
      t("task.end_before_start"),
    );
    expect(patchSpy).not.toHaveBeenCalled();

    // Valid end time clears error and sends patch
    fireEvent.change(endInput, { target: { value: "15:00" } });
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { end_time: "15:00" },
        expect.any(String),
      ),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Field edge cases and accessibility", () => {
  it("resets title to previous value with task.title_required on blur when cleared", async () => {
    const { patchSpy } = open(task({ title: "Keep This Title" }));
    const input = screen.getByLabelText(t("task.title")) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(input.value).toBe("Keep This Title");
    expect(screen.getByRole("alert").textContent).toBe(
      t("task.title_required"),
    );
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("sends no patch when title is unchanged (TK-E16)", async () => {
    const { patchSpy } = open(task({ title: "Same Title" }));
    const input = screen.getByLabelText(t("task.title"));
    fireEvent.change(input, { target: { value: "  Same Title  " } });
    fireEvent.blur(input);

    expect(patchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disables reminder without a due date and shows explanation", () => {
    open(task({ title: "No Date", due_date: null }));
    const select = screen.getByLabelText(
      t("task.reminder"),
    ) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText(t("task.reminder_needs_date"))).toBeTruthy();
  });

  it("shows helper when reminder time has already passed (TK-E4)", () => {
    open(
      task({
        title: "Passed Task",
        due_date: TODAY,
        start_time: "00:01",
        reminder: "15m",
      }),
    );
    expect(screen.getByText(t("task.reminder_past"))).toBeTruthy();
  });

  it("shows assistant tag as text with note link (A11Y-43)", () => {
    open(task({ title: "Assistant Task", created_by: "assistant" }));
    expect(screen.getByText(t("task.created_by_assistant"))).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: t("task.from_note", { name: "This week" }),
        })
        .getAttribute("href"),
    ).toBe("/notes/n1");
  });

  it("Mark done button completes the task", async () => {
    const { saved } = open(task({ title: "Toggle Task", done: false }));
    await userEvent.click(
      screen.getByRole("button", { name: t("task.mark_done") }),
    );
    await waitFor(() => expect(saved().done).toBe(true));
  });

  it("is axe clean in both themes", async () => {
    open(
      task({
        title: "Clean Task",
        due_date: TODAY,
        start_time: "10:00",
        end_time: "11:00",
        reminder: "15m",
        priority: "medium",
        created_by: "assistant",
      }),
    );
    await expectAxeCleanInBothThemes();
  });
});

describe("DetailsFooter", () => {
  it("shows footer times in the device's time zone", () => {
    open(
      task({
        title: "Footer Task",
        created_at: "2026-10-21T20:00:00Z",
        updated_at: "2026-10-22T18:30:00Z",
      }),
    );
    // In harness, clock is Asia/Ho_Chi_Minh (UTC+7), today is 2026-10-23.
    // 2026-10-22T18:30:00Z in Ho Chi Minh is 2026-10-23 01:30 -> "Edited Today 01:30"
    expect(screen.getByText(/Edited Today 01:30/)).toBeTruthy();
    // 2026-10-21T20:00:00Z in Ho Chi Minh is 2026-10-22 03:00 -> yesterday relative to 2026-10-23 -> "Created Yesterday"
    expect(screen.getByText(/Created Yesterday/)).toBeTruthy();
  });

  it("shows day name when created date is not yesterday or today", () => {
    render(
      <DetailsFooter
        createdAt="2026-10-21T20:00:00Z"
        updatedAt="2026-10-22T18:30:00Z"
        todayDate="2026-10-24"
        timeZone="Asia/Ho_Chi_Minh"
        timeFormat="24h"
      />,
    );
    // With today 2026-10-24, created 2026-10-22 (Thu) is 2 days ago -> "Created Thu 22 Oct"
    expect(screen.getByText(/Created Thu 22 Oct/)).toBeTruthy();
  });
});
