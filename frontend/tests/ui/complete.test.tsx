import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ProgressSummary,
  SETTLE_MS,
  TaskRow,
  inboxProgress,
  nextUp,
  useTaskStore,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

function TodayList() {
  const store = useTaskStore();
  const progress = inboxProgress(
    store.tasks,
    store.today,
    store.completedToday,
  );
  const open = store.tasks.filter((x) => !x.done || store.isSettling(x.id));
  return (
    <>
      <ProgressSummary
        progress={progress}
        next={nextUp(open.filter((x) => !x.done))}
        timeFormat={store.timeFormat}
      />
      <ul className="m-0 list-none p-0" aria-label="Today">
        {open.map((x) => (
          <TaskRow
            key={x.id}
            task={x}
            project={store.projectOf(x)}
            today={store.today}
            timeFormat={store.timeFormat}
            onToggle={store.toggle}
          />
        ))}
      </ul>
      <ul className="m-0 list-none p-0" aria-label="Completed">
        {store.tasks
          .filter((x) => x.done && !store.isSettling(x.id))
          .map((x) => (
            <TaskRow
              key={x.id}
              task={x}
              today={store.today}
              timeFormat={store.timeFormat}
              onToggle={store.toggle}
            />
          ))}
      </ul>
    </>
  );
}

const seed = () => [
  task({
    title: "Read chapter 4 for SQL",
    due_date: TODAY,
    project_id: "p-sql",
  }),
  task({
    title: "Review lecture 6 notes",
    due_date: TODAY,
    start_time: "16:00",
    end_time: "17:00",
    project_id: "p-hci",
  }),
  task({
    title: "Submit HCI reflection",
    due_date: "2026-10-22",
    project_id: "p-hci",
  }),
];

describe("inboxProgress (LV-1)", () => {
  it("counts open due-today and overdue tasks plus those completed today", () => {
    const tasks = [
      task({ title: "a", due_date: TODAY }),
      task({ title: "b", due_date: "2026-10-20" }),
      task({
        title: "c",
        due_date: TODAY,
        done: true,
        done_at: "2026-10-23T02:00:00Z",
      }),
      task({
        title: "d",
        due_date: "2026-10-21",
        done: true,
        done_at: "2026-10-23T03:00:00Z",
      }),
      task({
        title: "old",
        due_date: "2026-10-21",
        done: true,
        done_at: "2026-10-21T03:00:00Z",
      }),
      task({ title: "later", due_date: "2026-10-24" }),
      task({ title: "undated" }),
    ];
    const completedToday = (x: { done_at: string | null }) =>
      !!x.done_at && x.done_at.startsWith("2026-10-23");
    expect(inboxProgress(tasks, TODAY, completedToday)).toEqual({
      done: 2,
      total: 4,
    });
  });

  it("picks the next timed task first", () => {
    const tasks = [
      task({ title: "untimed" }),
      task({ title: "later", start_time: "20:00" }),
      task({ title: "sooner", start_time: "16:00" }),
    ];
    expect(nextUp(tasks)!.title).toBe("sooner");
  });
});

describe("Complete a task (TK-1, WF-06)", () => {
  it("ticks in place, updates progress, shows the toast, then moves to Completed (T-TK-01)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { wrap, memory } = setup(seed());
      render(wrap(<TodayList />));
      expect(screen.getByText("0 of 3 done").getAttribute("aria-live")).toBe(
        "polite",
      );
      await userEvent.click(
        screen.getByRole("checkbox", {
          name: "Complete Read chapter 4 for SQL",
        }),
      );

      // Struck through but still in Today for SETTLE_MS, so it doesn't jump from under the thumb
      const today = screen.getByRole("list", { name: "Today" });
      expect(today.textContent).toContain("Read chapter 4 for SQL");
      expect(
        screen
          .getByRole("checkbox", { name: "Reopen Read chapter 4 for SQL" })
          .getAttribute("aria-checked"),
      ).toBe("true");
      expect(screen.getByText("1 of 3 done")).toBeTruthy();
      expect(screen.getByText("1 down, 2 to go!")).toBeTruthy();
      expect(
        screen.getByText("Completed “Read chapter 4 for SQL”"),
      ).toBeTruthy();

      await act(async () => vi.advanceTimersByTime(SETTLE_MS));
      expect(
        screen.getByRole("list", { name: "Completed" }).textContent,
      ).toContain("Read chapter 4 for SQL");
      expect(memory.db.tasks[0]!.done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Undo in the toast reopens the task (T-TK-03, UX-05)", async () => {
    const { wrap, memory } = setup(seed());
    render(wrap(<TodayList />));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Review lecture 6 notes" }),
    );
    await waitFor(() => expect(memory.db.tasks[1]!.done).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(memory.db.tasks[1]!.done).toBe(false));
    expect(
      screen.getByRole("checkbox", { name: "Complete Review lecture 6 notes" }),
    ).toBeTruthy();
    expect(screen.getByText("0 of 3 done")).toBeTruthy();
  });

  it("reverts the row and offers Retry when the server rejects it (UX-01)", async () => {
    const { wrap, memory } = setup(seed());
    render(wrap(<TodayList />));
    memory.fail();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Submit HCI reflection" }),
    );
    await screen.findByText("Couldn't save that change.");
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Submit HCI reflection" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(memory.db.tasks[2]!.done).toBe(true));
  });

  it("unticking a completed task reopens it without a toast", async () => {
    const { wrap, memory } = setup([
      task({
        title: "Done one",
        due_date: TODAY,
        done: true,
        done_at: "2026-10-23T00:30:00Z",
      }),
    ]);
    render(wrap(<TodayList />));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Reopen Done one" }),
    );
    await waitFor(() => expect(memory.db.tasks[0]!.done).toBe(false));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("progress summary is axe clean in both themes", async () => {
    const { wrap } = setup(seed());
    render(wrap(<TodayList />));
    await expectAxeCleanInBothThemes();
  });
});
