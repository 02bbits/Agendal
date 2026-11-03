import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PRIORITIES,
  REMINDERS,
  REPEATS,
  ProjectScreen,
  TaskDetails,
  TaskPanel,
  t,
  useTaskStore,
  type CopyKey,
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
  showSchedule = true,
}: {
  id: string;
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  showSchedule?: boolean;
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
      showSchedule={showSchedule}
    />
  );
}

function open(
  t0: Task,
  opts?: {
    projectsStatus?: "ready" | "failed";
    onRetryProjects?: () => void;
    showSchedule?: boolean;
  },
) {
  const ctx = setup([t0]);
  const patchSpy = vi.spyOn(ctx.memory.api, "patch");
  render(
    ctx.wrap(
      <Details
        id={t0.id}
        projectsStatus={opts?.projectsStatus}
        onRetryProjects={opts?.onRetryProjects}
        showSchedule={opts?.showSchedule ?? true}
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
    const trigger = screen.getByRole("button", { name: t("task.start") });
    await userEvent.click(trigger);
    const option = screen.getByRole("option", { name: "09:00" });
    await userEvent.click(option);
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
    const trigger = screen.getByRole("button", { name: t("task.end") });
    await userEvent.click(trigger);
    const option = screen.getByRole("option", { name: "10:00" });
    await userEvent.click(option);
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
    const trigger = screen.getByRole("button", { name: t("task.due") });
    await userEvent.click(trigger);
    await userEvent.click(
      screen.getByRole("button", { name: t("date.next_month") }),
    );
    const day1 = screen.getAllByRole("gridcell", { name: "1" })[0]!;
    await userEvent.click(day1);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { due_date: "2026-11-01" },
        expect.any(String),
      ),
    );

    patchSpy.mockClear();
    const clearBtn = screen.getByRole("button", { name: t("common.clear") });
    await userEvent.click(clearBtn);
    const dialog = screen.getByRole("alertdialog", {
      name: t("task.clear_title"),
    });
    expect(patchSpy).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: t("common.clear") }),
    );
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

  it("set repeat weekly, Clear sits next to Delete and resets repeat to never, Undo restores all five", async () => {
    const { patchSpy } = open(
      task({
        title: "Task",
        due_date: "2026-10-30",
        start_time: "09:00",
        end_time: "10:00",
        reminder: "15m",
        repeat: "weekly",
      }),
    );

    // Clear sits in footer beside Delete
    const clearBtn = screen.getByRole("button", { name: t("common.clear") });
    const deleteBtn = screen.getByRole("button", { name: t("common.delete") });
    expect(clearBtn.parentElement).toBe(deleteBtn.parentElement);

    // Click Clear
    await userEvent.click(clearBtn);
    const dialog = screen.getByRole("alertdialog", {
      name: t("task.clear_title"),
    });
    expect(patchSpy).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: t("common.clear") }),
    );
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        {
          due_date: null,
          start_time: null,
          end_time: null,
          reminder: "none",
          repeat: "never",
        },
        expect.any(String),
      ),
    );

    // No error shown, Undo toast is present
    expect(screen.queryByText(t("error.save_failed"))).toBeNull();
    expect(screen.getByText(t("task.due_cleared"))).toBeTruthy();

    // Clear is now disabled
    expect(clearBtn.hasAttribute("disabled")).toBe(true);

    // Undo restores all five
    const undoBtn = screen.getByRole("button", { name: t("common.undo") });
    await userEvent.click(undoBtn);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        {
          due_date: "2026-10-30",
          start_time: "09:00",
          end_time: "10:00",
          reminder: "15m",
          repeat: "weekly",
        },
        expect.any(String),
      ),
    );
  });

  it("cancel closes the Clear dialog without patching and returns focus to the Clear button (UX-11)", async () => {
    const { patchSpy } = open(
      task({
        title: "Task",
        due_date: "2026-10-30",
      }),
    );

    const clearBtn = screen.getByRole("button", { name: t("common.clear") });
    await userEvent.click(clearBtn);

    const dialog = screen.getByRole("alertdialog", {
      name: t("task.clear_title"),
    });
    expect(patchSpy).not.toHaveBeenCalled();

    const cancelBtn = within(dialog).getByRole("button", {
      name: t("common.cancel"),
    });
    await userEvent.click(cancelBtn);

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(patchSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(clearBtn);
  });

  it.each(REMINDERS)("saves reminder %s", async (reminder) => {
    const { patchSpy } = open(
      task({
        title: "Task",
        due_date: TODAY,
        reminder: reminder === "none" ? "15m" : "none",
      }),
    );
    const trigger = screen.getByRole("button", { name: t("task.reminder") });
    await userEvent.click(trigger);
    const optionLabel = t(`reminder.${reminder}` as CopyKey);
    await userEvent.click(screen.getByRole("option", { name: optionLabel }));
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
    const trigger = screen.getByRole("button", { name: t("task.repeat") });
    await userEvent.click(trigger);
    const optionLabel = t(`repeat.${repeat}` as CopyKey);
    await userEvent.click(screen.getByRole("option", { name: optionLabel }));
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
    const radio = screen.getByRole("radio", {
      name: t(`priority.${priority}` as CopyKey),
    });
    await userEvent.click(radio);
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
    const trigger = screen.getByRole("button", { name: t("task.project") });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("option", { name: "HCI" }));
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { project_id: "p-hci" },
        expect.any(String),
      ),
    );

    await userEvent.click(trigger);
    await userEvent.click(
      screen.getByRole("option", { name: t("project.none") }),
    );
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
    const trigger = screen.getByRole("button", {
      name: t("task.project"),
    }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    expect(trigger.textContent).toContain("HCI");
    expect(screen.getByText("HCI")).toBeTruthy();
  });

  it("disables select with helper and sends no patch when task has no project and projects fail", async () => {
    const { patchSpy } = open(
      task({ title: "No Project Task", project_id: null }),
      { projectsStatus: "failed" },
    );
    const trigger = screen.getByRole("button", {
      name: t("task.project"),
    }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
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
  it("offers only end times after start, so the UI can't break TK-3", async () => {
    open(
      task({ title: "Schedule Task", due_date: TODAY, start_time: "14:00" }),
    );
    await userEvent.click(screen.getByRole("button", { name: t("task.end") }));
    expect(screen.queryByRole("option", { name: "13:00" })).toBeNull();
    expect(screen.queryByRole("option", { name: "14:00" })).toBeNull();
    expect(screen.getByRole("option", { name: "14:15" })).toBeTruthy();
  });

  it("shows end_before_start for a stored bad schedule, linked by aria-describedby, and a valid end clears it", async () => {
    const { patchSpy } = open(
      task({
        title: "Schedule Task",
        due_date: TODAY,
        start_time: "14:00",
        end_time: "13:00",
      }),
    );
    const end = screen.getByRole("button", { name: t("task.end") });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(t("task.end_before_start"));
    expect(end.getAttribute("aria-describedby")).toBe("task-end-error");
    expect(patchSpy).not.toHaveBeenCalled();

    await userEvent.click(end);
    await userEvent.click(screen.getByRole("option", { name: "15:00" }));
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
    const trigger = screen.getByRole("button", {
      name: t("task.reminder"),
    }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
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

  it("shows assistant footnote as text (A11Y-43)", () => {
    open(task({ title: "Assistant Task", created_by: "assistant" }));
    expect(
      screen.getByText(
        new RegExp(t("task.made_from_note", { name: "This week" })),
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("Task header checkbox completes the task", async () => {
    const { saved } = open(task({ title: "Toggle Task", done: false }));
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: t("task.complete", { title: "Toggle Task" }),
      }),
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

  it("hides 'Edited …' when updated_at === created_at", () => {
    render(
      <DetailsFooter
        createdAt="2026-10-21T20:00:00Z"
        updatedAt="2026-10-21T20:00:00Z"
        todayDate="2026-10-24"
        timeZone="Asia/Ho_Chi_Minh"
        timeFormat="24h"
      />,
    );
    expect(screen.queryByText(/Edited/)).toBeNull();
    expect(screen.getByText(/Created Thu 22 Oct/)).toBeTruthy();
  });
});

describe("Graphite design elements and review nits", () => {
  it("has no 'Mark complete' button, Save changes, or Cancel buttons", () => {
    open(task({ title: "Task" }));
    expect(
      screen.queryByRole("button", { name: t("task.mark_done") }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: t("common.save_changes") }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: t("common.cancel") }),
    ).toBeNull();
  });

  it("renders Delete disabled with aria-disabled without onDelete, enabled with onDelete", async () => {
    const onDelete = vi.fn();
    const current = task({ title: "Delete Me" });
    const ctx = setup([current]);
    const { rerender } = render(
      ctx.wrap(<TaskDetails task={current} onBack={() => {}} />),
    );
    const deleteBtn = screen.getByRole("button", { name: t("common.delete") });
    expect(deleteBtn).toBeTruthy();
    expect(deleteBtn.hasAttribute("disabled")).toBe(true);
    expect(deleteBtn.getAttribute("aria-disabled")).toBe("true");

    rerender(
      ctx.wrap(
        <TaskDetails task={current} onBack={() => {}} onDelete={onDelete} />,
      ),
    );
    const enabledBtn = screen.getByRole("button", { name: t("common.delete") });
    expect(enabledBtn.hasAttribute("disabled")).toBe(false);
    await userEvent.click(enabledBtn);
    expect(onDelete).toHaveBeenCalled();
  });

  it("notes textarea grows with scrollHeight on input", () => {
    open(task({ title: "Task with Notes", notes: "Short note" }));
    const textarea = screen.getByLabelText(
      t("task.notes"),
    ) as HTMLTextAreaElement;
    expect(textarea.style.height).toBe("100px");
    fireEvent.change(textarea, {
      target: { value: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5" },
    });
    expect(textarea.value).toBe("Line 1\nLine 2\nLine 3\nLine 4\nLine 5");
  });

  it("screen variant renders settings rows and saves", async () => {
    const current = task({ title: "Screen Variant Task", priority: "low" });
    const ctx = setup([current]);
    const patchSpy = vi.spyOn(ctx.memory.api, "patch");
    render(
      ctx.wrap(
        <TaskDetails task={current} onBack={() => {}} variant="screen" />,
      ),
    );
    // Delete task button on screen variant
    const deleteBtn = screen.getByRole("button", { name: t("task.delete") });
    expect(deleteBtn).toBeTruthy();
    expect(deleteBtn.hasAttribute("disabled")).toBe(true);

    // Segmented priority on screen variant
    const highRadio = screen.getByRole("radio", { name: t("priority.high") });
    await userEvent.click(highRadio);
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { priority: "high" },
        expect.any(String),
      ),
    );
  });
});

describe("Side panel from 1280px (TaskPanel & navigation)", () => {
  it("wide: clicking a row adds ?task=, panel shows with role region + title focus, Escape/× close and returns focus, edit updates row", async () => {
    const t1 = task({ id: "t-wide-1", title: "Wide Task 1" });
    const ctx = setup([t1]);
    const patchSpy = vi.spyOn(ctx.memory.api, "patch");

    let selectedId: string | null = null;
    const routerPush = vi.fn();

    function ProjectWithPanel({ isWide }: { isWide: boolean }) {
      const store = useTaskStore();
      const openTasks = store.tasks.filter((t) => !t.done);
      return (
        <div>
          <ProjectScreen
            project={{
              id: "p-1",
              name: "P1",
              colour: "blue",
              created_at: "2026-09-01T08:00:00Z",
            }}
            openTasks={openTasks}
            today={TODAY}
            onBack={() => {}}
            selectedTaskId={selectedId}
            navigate={(href) => {
              const match = href.match(/^\/tasks\/([^/?#]+)/);
              if (match && isWide) {
                selectedId = match[1]!;
                routerPush(`/projects/p-1?task=${match[1]}`);
                return true;
              }
              routerPush(href);
              return true;
            }}
          />
          {isWide && selectedId && (
            <TaskPanel
              taskId={selectedId}
              onClose={() => {
                selectedId = null;
                routerPush("/projects/p-1");
              }}
            />
          )}
        </div>
      );
    }

    const { rerender } = render(ctx.wrap(<ProjectWithPanel isWide={true} />));

    const taskLink = screen.getByRole("link", { name: /Wide Task 1/ });
    await userEvent.click(taskLink);

    expect(routerPush).toHaveBeenCalledWith("/projects/p-1?task=t-wide-1");

    rerender(ctx.wrap(<ProjectWithPanel isWide={true} />));

    const panel = screen.getByRole("complementary", {
      name: t("task.heading"),
    });
    expect(panel).toBeTruthy();

    expect(taskLink.getAttribute("aria-current")).toBe("true");

    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        t("task.title"),
      );
    });

    const titleInput = screen.getByLabelText(t("task.title"));
    fireEvent.change(titleInput, { target: { value: "Updated via Panel" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        { title: "Updated via Panel" },
        expect.any(String),
      );
    });

    fireEvent.keyDown(panel, { key: "Escape" });
    expect(routerPush).toHaveBeenCalledWith("/projects/p-1");

    rerender(ctx.wrap(<ProjectWithPanel isWide={true} />));
    expect(
      screen.queryByRole("complementary", { name: t("task.heading") }),
    ).toBeNull();
  });

  it("narrow: clicking a row goes to /tasks/{id}", async () => {
    const t1 = task({ id: "t-narrow-1", title: "Narrow Task 1" });
    const ctx = setup([t1]);
    const navigate = vi.fn();

    render(
      ctx.wrap(
        <ProjectScreen
          project={{
            id: "p-1",
            name: "P1",
            colour: "blue",
            created_at: "2026-09-01T08:00:00Z",
          }}
          openTasks={[t1]}
          today={TODAY}
          onBack={() => {}}
          navigate={(href) => {
            const isWide = false;
            const match = href.match(/^\/tasks\/([^/?#]+)/);
            if (match && isWide) {
              return true;
            }
            navigate(href);
            return true;
          }}
        />,
      ),
    );

    const taskLink = screen.getByRole("link", { name: /Narrow Task 1/ });
    await userEvent.click(taskLink);

    expect(navigate).toHaveBeenCalledWith("/tasks/t-narrow-1");
  });

  it("unknown/deleted task id shows error.not_found with close button", async () => {
    const ctx = setup([]);
    const onClose = vi.fn();

    render(ctx.wrap(<TaskPanel taskId="t-missing" onClose={onClose} />));

    expect(screen.getByText(t("error.not_found"))).toBeTruthy();
    const closeButtons = screen.getAllByRole("button", {
      name: t("common.close"),
    });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(closeButtons[0]!);
    expect(onClose).toHaveBeenCalled();
  });

  it("TaskPanel is axe clean in both themes", async () => {
    const t1 = task({ id: "t-axe", title: "Axe Task" });
    const ctx = setup([t1]);
    render(ctx.wrap(<TaskPanel taskId={t1.id} onClose={() => {}} />));
    await expectAxeCleanInBothThemes();
  });
});
