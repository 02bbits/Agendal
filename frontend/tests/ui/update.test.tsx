import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useTaskStore } from "../../src/ui";
import { task } from "./fixtures";
import { TODAY, deferredApi, setup } from "./harness";

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
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("store.update (Refs #22)", () => {
  it("saves valid fields optimistically and sends patch through API", async () => {
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

    // Optimistic update shows immediately
    expect(screen.getByTestId("title-t-1").textContent).toBe("Updated Title");

    // Flush microtasks for the queue request to begin
    await act(async () => {});

    expect(deferred.calls).toHaveLength(1);
    expect(deferred.calls[0].type).toBe("patch");
    expect(deferred.calls[0].id).toBe("t-1");
    expect(deferred.calls[0].patch).toEqual({ title: "Updated Title" });

    // Server responds
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

    // Invalid title
    act(() => {
      const errors = store.update(t1, { title: "   " });
      expect(errors).toEqual({ title: "task.title_required" });
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(0);
    expect(screen.getByTestId("title-t-1").textContent).toBe("Original Title");

    // Invalid schedule
    act(() => {
      const errors = store.update(t1, {
        start_time: "14:00",
        end_time: "13:00",
      });
      expect(errors).toEqual({ end_time: "task.end_before_start" });
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(0);

    // No changes (TK-E16)
    act(() => {
      const errors = store.update(t1, { title: "Original Title" });
      expect(errors).toEqual({});
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(0);
  });

  it("reverts only the failed task on patch error and shows error.save_failed with Retry", async () => {
    const t1 = task({ id: "t-1", title: "Task 1", due_date: TODAY });
    const t2 = task({ id: "t-2", title: "Task 2", due_date: TODAY });
    const deferred = deferredApi({ tasks: [t1, t2] });
    let store!: ReturnType<typeof useTaskStore>;

    render(
      setup([t1, t2], deferred.api).wrap(
        <TestComponent
          onMount={(s) => {
            store = s;
          }}
        />,
      ),
    );

    // Update t2 first successfully
    act(() => {
      store.update(t2, { title: "Task 2 Updated" });
    });
    await act(async () => {});
    expect(deferred.calls).toHaveLength(1);
    await act(async () => {
      deferred.calls[0].resolve();
    });
    expect(screen.getByTestId("title-t-2").textContent).toBe("Task 2 Updated");

    // Update t1 which will fail
    act(() => {
      store.update(t1, { title: "Task 1 New Title" });
    });
    expect(screen.getByTestId("title-t-1").textContent).toBe(
      "Task 1 New Title",
    );
    await act(async () => {});
    expect(deferred.calls).toHaveLength(2);

    // Reject the patch call
    await act(async () => {
      deferred.calls[1].reject(new Error("Network Error"));
    });

    // t1 is reverted, t2 remains updated
    expect(screen.getByTestId("title-t-1").textContent).toBe("Task 1");
    expect(screen.getByTestId("title-t-2").textContent).toBe("Task 2 Updated");

    // Toast with Retry is displayed
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeTruthy();

    // Clicking Retry attempts update again
    await userEvent.click(retryButton);
    await act(async () => {});
    expect(deferred.calls).toHaveLength(3);
    expect(deferred.calls[2].type).toBe("patch");
    expect(deferred.calls[2].id).toBe("t-1");
  });

  it("queues a patch behind an in-flight complete on the same task", async () => {
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

  it("shows toast with Undo when clearing due date, which restores dependent fields", async () => {
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

    // Fields are restored
    expect(screen.getByTestId("due-t-1").textContent).toBe(TODAY);
    expect(screen.getByTestId("start-t-1").textContent).toBe("09:00");
    expect(screen.getByTestId("end-t-1").textContent).toBe("10:00");
    expect(screen.getByTestId("reminder-t-1").textContent).toBe("15m");
  });
});
