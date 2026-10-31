import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../src/lib/apiError";
import {
  ProgressSummary,
  SETTLE_MS,
  TaskRow,
  inboxProgress,
  nextUp,
  useTaskStore,
} from "../../src/ui";
import type { Task } from "../../src/ui/domain/types";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, deferredApi, setup } from "./harness";

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

  it("a failed save reverts only its own task while others stay done (Refs #21)", async () => {
    const tasks = [
      task({ id: "t-a", title: "Task A", due_date: TODAY }),
      task({ id: "t-b", title: "Task B", due_date: TODAY }),
    ];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TodayList />));

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task A" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task B" }),
    );

    const callA = deferred.calls.find((c) => c.id === "t-a")!;
    const callB = deferred.calls.find((c) => c.id === "t-b")!;

    await act(async () => {
      callA.reject();
      callB.resolve();
    });

    await screen.findByText("Couldn't save that change.");
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task A" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect(
      screen
        .getByRole("checkbox", { name: "Reopen Task B" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("complete in flight -> Undo: reopen is not sent until complete settles (Refs #21)", async () => {
    const tasks = [task({ id: "t-1", title: "Task 1", due_date: TODAY })];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TodayList />));

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 1" }),
    );
    expect(deferred.calls).toHaveLength(1);
    expect(deferred.calls[0].type).toBe("complete");

    // Click Undo while complete is in flight
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    // reopen is NOT sent until complete settles
    expect(deferred.calls).toHaveLength(1);

    // Settle complete
    await act(async () => {
      deferred.calls[0].resolve();
    });

    // Now reopen is sent
    expect(deferred.calls).toHaveLength(2);
    expect(deferred.calls[1].type).toBe("reopen");

    // Settle reopen
    await act(async () => {
      deferred.calls[1].resolve();
    });

    // Task is open
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("complete in flight -> Undo: late complete response is ignored and task stays open (Refs #21)", async () => {
    const tasks = [task({ id: "t-1", title: "Task 1", due_date: TODAY })];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TodayList />));

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 1" }),
    );
    expect(deferred.calls).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    // Resolve complete late with a done task
    await act(async () => {
      deferred.calls[0].resolve({
        task: { ...tasks[0], done: true, done_at: "2026-10-23T08:00:00Z" },
      });
    });

    // Task stays open, late response is ignored
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("false");

    // Settle reopen
    expect(deferred.calls).toHaveLength(2);
    await act(async () => {
      deferred.calls[1].resolve();
    });

    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("complete fails after Undo -> no revert and no Retry toast for old request (Refs #21)", async () => {
    const tasks = [task({ id: "t-1", title: "Task 1", due_date: TODAY })];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TodayList />));

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 1" }),
    );
    expect(deferred.calls).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    // Complete fails after Undo
    await act(async () => {
      deferred.calls[0].reject(new Error("server error"));
    });

    // No Retry toast for the old request
    expect(screen.queryByText("Couldn't save that change.")).toBeNull();

    // Settle reopen
    expect(deferred.calls).toHaveLength(2);
    await act(async () => {
      deferred.calls[1].resolve();
    });

    // Task stays open (no revert)
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("bug 1: complete scenario end-to-end (Refs #21)", async () => {
    const tasks = [
      task({ id: "t-1", title: "Task 1", due_date: TODAY, done: false }),
    ];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TodayList />));

    // Complete task 1
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 1" }),
    );
    expect(deferred.calls).toHaveLength(1);

    // Undo while complete in flight
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    // Complete fails -> nothing rolled back, no error toast
    await act(async () => {
      deferred.calls[0].reject(new Error("complete failed"));
    });
    expect(screen.queryByText("Couldn't save that change.")).toBeNull();
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("false");

    // Reopen was queued; now resolve it
    expect(deferred.calls).toHaveLength(2);
    await act(async () => {
      deferred.calls[1].resolve();
    });
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("false");

    // Next: complete succeeds, then reopen fails -> rolls back to confirmed true
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 1" }),
    );
    expect(deferred.calls).toHaveLength(3);
    await act(async () => {
      deferred.calls[2].resolve();
    });
    expect(
      screen
        .getByRole("checkbox", { name: "Reopen Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("true");

    // Click Undo -> reopen is sent
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(deferred.calls).toHaveLength(4);

    // Reopen fails -> rolls back to confirmed true
    await act(async () => {
      deferred.calls[3].reject(new Error("reopen failed"));
    });
    await screen.findByText("Couldn't save that change.");
    expect(
      screen
        .getByRole("checkbox", { name: "Reopen Task 1" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("bug 2: a row never changes position after a failure (Refs #21)", async () => {
    const tasks = [
      task({ id: "t-1", title: "Task 1", due_date: TODAY }),
      task({ id: "t-2", title: "Task 2", due_date: TODAY }),
      task({ id: "t-3", title: "Task 3", due_date: TODAY }),
    ];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TodayList />));

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 2" }),
    );
    await act(async () => {
      deferred.calls[0].reject(new Error("failed"));
    });
    await screen.findByText("Couldn't save that change.");

    const todayList = screen.getByRole("list", { name: "Today" });
    const items = Array.from(todayList.querySelectorAll("li")).map(
      (li) => li.textContent,
    );
    expect(items[0]).toContain("Task 1");
    expect(items[1]).toContain("Task 2");
    expect(items[2]).toContain("Task 3");
  });

  it("bug 3: a field changed while complete is in flight survives its failure (Refs #21)", async () => {
    function TestWithRename() {
      const store = useTaskStore();
      return (
        <>
          <TodayList />
          <button
            onClick={() => {
              store.change(
                "t-1",
                { title: "Renamed Title" },
                () => new Promise(() => {}),
              );
            }}
          >
            Rename Task 1
          </button>
        </>
      );
    }

    const tasks = [
      task({ id: "t-1", title: "Original Title", due_date: TODAY }),
    ];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TestWithRename />));

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Original Title" }),
    );
    expect(deferred.calls).toHaveLength(1);

    await userEvent.click(
      screen.getByRole("button", { name: "Rename Task 1" }),
    );
    expect(screen.getByText("Renamed Title")).toBeTruthy();

    await act(async () => {
      deferred.calls[0].reject(new Error("complete failed"));
    });

    await screen.findByText("Couldn't save that change.");
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Renamed Title" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect(screen.getByText("Renamed Title")).toBeTruthy();
  });

  it("bug 4: Undo after a successful complete keeps the server's updated_at (Refs #21)", async () => {
    let latestTask: Task | undefined;
    function Inspector() {
      const store = useTaskStore();
      const current = store.tasks.find((t) => t.id === "t-1");
      useEffect(() => {
        latestTask = current;
      }, [current]);
      return null;
    }

    const initialUpdatedAt = "2026-10-23T01:00:00Z";
    const serverUpdatedAt = "2026-10-23T01:30:00Z";
    const tasks = [
      task({
        id: "t-1",
        title: "Task 1",
        due_date: TODAY,
        updated_at: initialUpdatedAt,
      }),
    ];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(
      wrap(
        <>
          <TodayList />
          <Inspector />
        </>,
      ),
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 1" }),
    );
    await act(async () => {
      deferred.calls[0].resolve({
        task: {
          ...tasks[0],
          done: true,
          done_at: "2026-10-23T01:12:00Z",
          updated_at: serverUpdatedAt,
        },
      });
    });

    expect(latestTask?.updated_at).toBe(serverUpdatedAt);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(latestTask?.done).toBe(false);
    expect(latestTask?.updated_at).toBe(serverUpdatedAt);
  });

  it("bug 5: tick, Undo, tick within 600 ms: the row stays settling the full 600 ms of the second tick (Refs #21)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const tasks = [task({ id: "t-1", title: "Task 1", due_date: TODAY })];
      const { wrap } = setup(tasks);
      render(wrap(<TodayList />));

      await userEvent.click(
        screen.getByRole("checkbox", { name: "Complete Task 1" }),
      );
      expect(screen.getByRole("list", { name: "Today" }).textContent).toContain(
        "Task 1",
      );

      await act(async () => vi.advanceTimersByTime(200));

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(screen.getByRole("list", { name: "Today" }).textContent).toContain(
        "Task 1",
      );
      expect(
        screen
          .getByRole("checkbox", { name: "Complete Task 1" })
          .getAttribute("aria-checked"),
      ).toBe("false");

      await userEvent.click(
        screen.getByRole("checkbox", { name: "Complete Task 1" }),
      );

      await act(async () => vi.advanceTimersByTime(500));
      expect(screen.getByRole("list", { name: "Today" }).textContent).toContain(
        "Task 1",
      );
      expect(
        screen.queryByRole("list", { name: "Completed" })?.textContent ?? "",
      ).not.toContain("Task 1");

      await act(async () => vi.advanceTimersByTime(100));
      expect(
        screen.getByRole("list", { name: "Completed" }).textContent,
      ).toContain("Task 1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bug 6: task.limit shows its message without Retry; 500 shows save_failed with Retry (Refs #21)", async () => {
    const tasks = [
      task({ id: "t-limit", title: "Task Limit", due_date: TODAY }),
      task({ id: "t-500", title: "Task 500", due_date: TODAY }),
    ];
    const deferred = deferredApi({ tasks });
    const { wrap } = setup(tasks, deferred.api);
    render(wrap(<TodayList />));

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task Limit" }),
    );
    await act(async () => {
      deferred.calls[0].reject(new ApiRequestError("task.limit", 422, "req-1"));
    });

    await screen.findByText(
      "You've reached 5,000 open tasks. Complete or delete some to add more.",
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(
      screen
        .getByRole("checkbox", { name: "Complete Task Limit" })
        .getAttribute("aria-checked"),
    ).toBe("false");

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Task 500" }),
    );
    await act(async () => {
      deferred.calls[1].reject(
        new ApiRequestError("error.generic", 500, "req-2"),
      );
    });

    await screen.findByText("Couldn't save that change.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
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

  it("unmount right after a tick: clears timers and leaves vi.getTimerCount() at 0 (Refs #21)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { wrap } = setup(seed());
      const { unmount } = render(wrap(<TodayList />));

      await userEvent.click(
        screen.getByRole("checkbox", {
          name: "Complete Read chapter 4 for SQL",
        }),
      );

      expect(vi.getTimerCount()).toBeGreaterThan(0);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("progress summary is axe clean in both themes", async () => {
    const { wrap } = setup(seed());
    render(wrap(<TodayList />));
    await expectAxeCleanInBothThemes();
  });
});
