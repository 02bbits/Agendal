import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { TaskApi } from "../../src/ui/domain/api";
import type { Task } from "../../src/ui/domain/types";
import {
  TaskStoreProvider,
  useTaskStore,
} from "../../src/ui/features/tasks/store";

afterEach(cleanup);

const task: Task = {
  id: "root",
  title: "Gym",
  start_date: null,
  due_date: "2026-11-02",
  start_time: null,
  due_time: null,
  priority: "low",
  project_id: null,
  repeat: "weekly",
  reminder: "none",
  notes: null,
  done: false,
  done_at: null,
  created_by: "assistant",
  created_at: "2026-11-01T15:11:00Z",
};
const next: Task = {
  ...task,
  id: "next",
  title: "Next gym",
  due_date: "2026-11-04",
};

function CalendarRows() {
  const store = useTaskStore();
  return (
    <>
      {store.tasks.map((row) => (
        <button key={row.id} onClick={() => store.toggle(row)}>
          {row.title}: {row.done ? "done" : "open"}
        </button>
      ))}
      {store.toast?.onAction && (
        <button onClick={store.toast.onAction}>Undo</button>
      )}
    </>
  );
}

it("shows the generated occurrence, removes it on Undo and restores it once on recompletion", async () => {
  const api: TaskApi = {
    complete: vi.fn(async () => ({ task: { ...task, done: true }, next })),
    reopen: vi.fn(async () => ({ task, next })),
    patch: vi.fn(async () => task),
  };
  render(
    <TaskStoreProvider
      api={api}
      clock={{
        now: () => new Date("2026-11-01T15:11:00Z"),
        timeZone: "Asia/Ho_Chi_Minh",
      }}
      initialTasks={[task]}
      initialProjects={[]}
    >
      <CalendarRows />
    </TaskStoreProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Gym: open" }));
  await screen.findByRole("button", { name: "Next gym: open" });
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Next gym: open" })).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Gym: open" }));
  await screen.findByRole("button", { name: "Next gym: open" });
  expect(
    screen.getAllByRole("button", { name: "Next gym: open" }),
  ).toHaveLength(1);
});

it("fast complete → Undo → complete keeps exactly one generated occurrence", async () => {
  // The server answers in order; every answer only arrives after all three clicks
  const n1: Task = { ...next, id: "n1", title: "Gym n1" };
  const n2: Task = { ...next, id: "n2", title: "Gym n2" };
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let completes = 0;
  const api: TaskApi = {
    complete: vi.fn(async () => {
      await gate;
      completes += 1;
      return { task: { ...task, done: true }, next: completes === 1 ? n1 : n2 };
    }),
    reopen: vi.fn(async () => {
      await gate;
      return { task, next: n1 };
    }),
    patch: vi.fn(async () => task),
  };
  render(
    <TaskStoreProvider
      api={api}
      clock={{
        now: () => new Date("2026-11-01T15:11:00Z"),
        timeZone: "Asia/Ho_Chi_Minh",
      }}
      initialTasks={[task]}
      initialProjects={[]}
    >
      <CalendarRows />
    </TaskStoreProvider>,
  );
  // Complete, Undo from the toast, complete again — all before any answer
  fireEvent.click(screen.getByRole("button", { name: "Gym: open" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  fireEvent.click(screen.getByRole("button", { name: "Gym: open" }));
  release();
  await screen.findByRole("button", { name: "Gym n2: open" });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Gym n1: open" })).toBeNull(),
  );
  expect(screen.getAllByRole("button", { name: /^Gym n/ })).toHaveLength(1);
});

it("ignores more clicks on a task's tick while it settles after Complete", async () => {
  const api: TaskApi = {
    complete: vi.fn(async () => ({
      task: { ...task, done: true },
    })),
    reopen: vi.fn(async () => ({ task })),
    patch: vi.fn(async () => task),
  };
  render(
    <TaskStoreProvider
      api={api}
      clock={{
        now: () => new Date("2026-11-01T15:11:00Z"),
        timeZone: "Asia/Ho_Chi_Minh",
      }}
      initialTasks={[task]}
      initialProjects={[]}
    >
      <CalendarRows />
    </TaskStoreProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Gym: open" }));
  fireEvent.click(screen.getByRole("button", { name: "Gym: done" }));
  fireEvent.click(screen.getByRole("button", { name: "Gym: done" }));
  await waitFor(() => expect(api.complete).toHaveBeenCalledTimes(1));
  expect(api.reopen).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Gym: done" })).toBeTruthy();
});
