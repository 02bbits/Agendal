import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../src/lib/apiError";
import { t } from "../../src/ui/copy";
import { useTaskStore } from "../../src/ui";
import { task } from "./fixtures";
import { clock, TODAY, deferredApi, setup } from "./harness";

function TestComponent({
  onMount,
}: {
  onMount: (store: ReturnType<typeof useTaskStore>) => void;
}) {
  const store = useTaskStore();
  onMount(store);
  return (
    <div>
      <ul data-testid="task-list">
        {store.tasks.map((t) => (
          <li key={t.id} data-testid={`task-${t.id}`}>
            <span data-testid={`title-${t.id}`}>{t.title}</span>
            <span data-testid={`due-${t.id}`}>{t.due_date ?? "none"}</span>
            <span data-testid={`start-${t.id}`}>{t.start_time ?? "none"}</span>
            <span data-testid={`end-${t.id}`}>{t.end_time ?? "none"}</span>
            <span data-testid={`reminder-${t.id}`}>{t.reminder}</span>
            <span data-testid={`priority-${t.id}`}>{t.priority}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("store.update (Refs #22)", () => {
  it("saves valid fields optimistically and sends patch with at through API", async () => {
    const t1 = task({ id: "t-1", title: "Original Title", due_date: TODAY });
    const deferred = deferredApi({ tasks: [t1] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    act(() => {
      const errors = store.update(t1, { title: "Updated Title" });
      expect(errors).toEqual({});
    });

    expect(screen.getByTestId("title-t-1").textContent).toBe("Updated Title");

    await act(async () => {});

    expect(deferred.calls).toHaveLength(1);
    expect(deferred.calls[0].type).toBe("patch");
    expect(deferred.calls[0].id).toBe("t-1");
    expect(deferred.calls[0].at).toBe(clock.now().toISOString());
    expect(deferred.calls[0].patch).toEqual({ title: "Updated Title" });

    await act(async () => {
      deferred.calls[0].resolve();
    });

    expect(screen.getByTestId("title-t-1").textContent).toBe("Updated Title");
  });

  it("does not send invalid patches or patches with no changes", async () => {
    const t1 = task({ id: "t-1", title: "Original Title", due_date: TODAY });
    const deferred = deferredApi({ tasks: [t1] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    // Empty title
    act(() => {
      const errors = store.update(t1, { title: "   " });
      expect(errors).toEqual({ title: "task.title_required" });
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(0);

    // Schedule error (end <= start)
    act(() => {
      const errors = store.update(t1, {
        start_time: "10:00",
        end_time: "09:00",
      });
      expect(errors).toEqual({ end_time: "task.end_before_start" });
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(0);

    // Reminder needs date
    const tNoDate = task({ id: "t-2", title: "No Date", due_date: null });
    act(() => {
      const errors = store.update(tNoDate, { reminder: "15m" });
      expect(errors).toEqual({ reminder: "task.reminder_needs_date" });
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(0);

    // No changes (identical fields)
    act(() => {
      const errors = store.update(t1, { title: "Original Title" });
      expect(errors).toEqual({});
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(0);
  });

  it("failure of a field edit rolls back ONLY that field (another field changed meanwhile survives)", async () => {
    const t1 = task({
      id: "t-1",
      title: "Title A",
      priority: "low",
      due_date: TODAY,
    });
    const deferred = deferredApi({ tasks: [t1] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    // First change: title
    act(() => {
      store.update(t1, { title: "Title B" });
    });
    // Second change meanwhile: priority
    act(() => {
      store.update(t1, { priority: "high" });
    });

    expect(screen.getByTestId("title-t-1").textContent).toBe("Title B");

    await act(async () => {});
    expect(deferred.calls).toHaveLength(1);
    expect(deferred.calls[0].patch).toEqual({ title: "Title B" });

    // First patch fails
    await act(async () => {
      deferred.calls[0].reject(new Error("Network error"));
    });

    // Title is rolled back to "Title A", while priority remains "high"
    expect(screen.getByTestId("title-t-1").textContent).toBe("Title A");
    expect(screen.getByTestId("priority-t-1").textContent).toBe("high");

    // Second patch runs and resolves
    await act(async () => {});
    expect(deferred.calls).toHaveLength(2);
    expect(deferred.calls[1].patch).toEqual({ priority: "high" });

    await act(async () => {
      deferred.calls[1].resolve();
    });

    expect(screen.getByTestId("title-t-1").textContent).toBe("Title A");
    expect(screen.getByTestId("priority-t-1").textContent).toBe("high");
  });

  it("queues an edit behind an in-flight complete", async () => {
    const t1 = task({
      id: "t-1",
      title: "Task 1",
      due_date: TODAY,
      done: false,
    });
    const deferred = deferredApi({ tasks: [t1] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    // Complete is initiated
    act(() => {
      store.toggle(t1);
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(1);
    expect(deferred.calls[0].type).toBe("complete");

    // While complete is in-flight, update is called
    act(() => {
      store.update(t1, { title: "Completed & Renamed" });
    });
    await act(async () => {});

    // Patch request is not initiated yet because complete hasn't finished
    expect(deferred.calls).toHaveLength(1);

    // Complete finishes
    await act(async () => {
      deferred.calls[0].resolve();
    });

    // Now patch runs
    expect(deferred.calls).toHaveLength(2);
    expect(deferred.calls[1].type).toBe("patch");
    expect(deferred.calls[1].patch).toEqual({ title: "Completed & Renamed" });

    // Patch finishes
    await act(async () => {
      deferred.calls[1].resolve();
    });

    expect(screen.getByTestId("title-t-1").textContent).toBe(
      "Completed & Renamed",
    );
  });

  it("shows message without Retry on task.limit-style 4xx", async () => {
    const t1 = task({ id: "t-1", title: "Task 1", due_date: TODAY });
    const deferred = deferredApi({ tasks: [t1] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    act(() => {
      store.update(t1, { title: "Task 1 New Title" });
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(1);

    // Reject with ApiRequestError for 422 task.limit
    await act(async () => {
      deferred.calls[0].reject(
        new ApiRequestError("task.limit", 422, "req-limit-422"),
      );
    });

    // Shows copy message for task.limit
    expect(screen.getByText(t("task.limit"))).toBeTruthy();
    // No Retry button
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows toast with Undo when clearing due date, which restores the four fields", async () => {
    const t1 = task({
      id: "t-1",
      title: "Task with Date and Schedule",
      due_date: TODAY,
      start_time: "09:00",
      end_time: "10:00",
      reminder: "15m",
    });
    const deferred = deferredApi({ tasks: [t1] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    // Clear due date
    act(() => {
      store.update(t1, { due_date: null });
    });

    // Check optimistic update: date, schedule and reminder cleared
    expect(screen.getByTestId("due-t-1").textContent).toBe("none");
    expect(screen.getByTestId("start-t-1").textContent).toBe("none");
    expect(screen.getByTestId("end-t-1").textContent).toBe("none");
    expect(screen.getByTestId("reminder-t-1").textContent).toBe("none");

    // Toast with Undo is shown
    const undoButton = screen.getByRole("button", { name: "Undo" });
    expect(undoButton).toBeTruthy();

    // Click Undo
    await userEvent.click(undoButton);

    // Four fields are restored
    expect(screen.getByTestId("due-t-1").textContent).toBe(TODAY);
    expect(screen.getByTestId("start-t-1").textContent).toBe("09:00");
    expect(screen.getByTestId("end-t-1").textContent).toBe("10:00");
    expect(screen.getByTestId("reminder-t-1").textContent).toBe("15m");
  });

  it("reverts failed patch on 500 error and allows Retry", async () => {
    const t1 = task({ id: "t-1", title: "Task 1", due_date: TODAY });
    const deferred = deferredApi({ tasks: [t1] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    act(() => {
      store.update(t1, { title: "New Title" });
    });
    expect(screen.getByTestId("title-t-1").textContent).toBe("New Title");

    await act(async () => {});
    expect(deferred.calls).toHaveLength(1);

    await act(async () => {
      deferred.calls[0].reject(new Error("500 Server Error"));
    });

    expect(screen.getByTestId("title-t-1").textContent).toBe("Task 1");

    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeTruthy();

    await userEvent.click(retryButton);
    await act(async () => {});

    expect(deferred.calls).toHaveLength(2);
    expect(deferred.calls[1].type).toBe("patch");
    expect(deferred.calls[1].patch).toEqual({ title: "New Title" });
  });
});
