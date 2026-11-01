import { describe, expect, it } from "vitest";
import {
  beginChange,
  createTaskSyncState,
  settleFailure,
  settleSuccess,
} from "../../src/ui/domain/sync";
import type { Task } from "../../src/ui/domain/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Write documentation",
    due_date: "2026-10-31",
    start_time: null,
    end_time: null,
    priority: "medium",
    project_id: null,
    repeat: "never",
    reminder: "none",
    notes: null,
    done: false,
    done_at: null,
    created_by: "user",
    created_at: "2026-10-31T08:00:00Z",
    updated_at: "2026-10-31T08:00:00Z",
    ...overrides,
  };
}

describe("field-level task sync (Refs #21)", () => {
  it("success of the latest request takes every server field (updated_at, done_at) — bug 4", () => {
    const initial = makeTask({
      done: false,
      done_at: null,
      updated_at: "2026-10-31T08:00:00Z",
    });
    let state = createTaskSyncState([initial]);
    const change = beginChange(state, initial, 1, {
      done: true,
      done_at: "2026-10-31T09:00:00Z",
    });
    state = change.state;
    const row = change.row;

    const serverTask: Task = {
      ...row,
      done: true,
      done_at: "2026-10-31T09:00:01Z",
      updated_at: "2026-10-31T09:00:02Z",
    };

    const result = settleSuccess(state, row, 1, serverTask);
    expect(result.row.done).toBe(true);
    expect(result.row.done_at).toBe("2026-10-31T09:00:01Z");
    expect(result.row.updated_at).toBe("2026-10-31T09:00:02Z");
    expect(result.state.confirmed.get(initial.id)).toEqual(serverTask);
    expect(result.state.writers.get(initial.id)).toBeUndefined();
  });

  it("success of an OLDER request updates confirmed but keeps the newer optimistic field", () => {
    const initial = makeTask({
      done: false,
      updated_at: "2026-10-31T08:00:00Z",
    });
    let state = createTaskSyncState([initial]);

    // Seq 1: complete
    const c1 = beginChange(state, initial, 1, { done: true });
    state = c1.state;

    // Seq 2: reopen (newer optimistic change)
    const c2 = beginChange(state, c1.row, 2, { done: false });
    state = c2.state;

    // Seq 1 succeeds late
    const serverTaskSeq1: Task = {
      ...initial,
      done: true,
      updated_at: "2026-10-31T09:00:00Z",
    };
    const result = settleSuccess(state, c2.row, 1, serverTaskSeq1);

    // Confirmed updated to server task
    expect(result.state.confirmed.get(initial.id)).toEqual(serverTaskSeq1);
    // Newer optimistic field (done: false) is kept
    expect(result.row.done).toBe(false);
    // Server-computed field updated_at is accepted
    expect(result.row.updated_at).toBe("2026-10-31T09:00:00Z");
    // Writer for done is still seq 2
    expect(result.state.writers.get(initial.id)?.get("done")).toBe(2);
  });

  it("failure rolls back only its own still-owned fields; another field changed meanwhile (e.g. title) survives — bug 3", () => {
    const initial = makeTask({
      title: "Original Title",
      done: false,
    });
    let state = createTaskSyncState([initial]);

    // Seq 1: complete
    const c1 = beginChange(state, initial, 1, { done: true });
    state = c1.state;

    // Seq 2: title change
    const c2 = beginChange(state, c1.row, 2, { title: "Updated Title" });
    state = c2.state;

    // Seq 1 fails
    const result = settleFailure(state, c2.row, 1, { done: true });
    expect(result.rolledBack).toBe(true);
    expect(result.row.done).toBe(false); // rolled back to confirmed false
    expect(result.row.title).toBe("Updated Title"); // title survived!
    expect(result.state.writers.get(initial.id)?.get("title")).toBe(2);
    expect(result.state.writers.get(initial.id)?.has("done")).toBe(false);
  });

  it("complete (seq 1) then reopen (seq 2) on done; complete fails → nothing rolled back; reopen fails → done back to the CONFIRMED false — bug 1", () => {
    const initial = makeTask({ done: false });
    let state = createTaskSyncState([initial]);

    // Seq 1: complete
    const c1 = beginChange(state, initial, 1, { done: true });
    state = c1.state;

    // Seq 2: reopen
    const c2 = beginChange(state, c1.row, 2, { done: false });
    state = c2.state;

    // Seq 1 fails
    const fail1 = settleFailure(state, c2.row, 1, { done: true });
    expect(fail1.rolledBack).toBe(false); // nothing rolled back because writer is seq 2
    expect(fail1.row.done).toBe(false);

    // Seq 2 fails
    const fail2 = settleFailure(fail1.state, fail1.row, 2, { done: false });
    expect(fail2.rolledBack).toBe(true); // rolled back
    expect(fail2.row.done).toBe(false); // back to CONFIRMED false
    expect(fail2.state.writers.get(initial.id)).toBeUndefined();
  });

  it("complete succeeds, then reopen fails → done back to the confirmed true (the server's truth)", () => {
    const initial = makeTask({ done: false });
    let state = createTaskSyncState([initial]);

    // Seq 1: complete
    const c1 = beginChange(state, initial, 1, { done: true });
    state = c1.state;

    // Complete succeeds
    const serverTask: Task = {
      ...initial,
      done: true,
      done_at: "2026-10-31T09:00:00Z",
      updated_at: "2026-10-31T09:00:00Z",
    };
    const s1 = settleSuccess(state, c1.row, 1, serverTask);
    state = s1.state;
    expect(s1.row.done).toBe(true);

    // Seq 2: reopen
    const c2 = beginChange(state, s1.row, 2, { done: false, done_at: null });
    state = c2.state;
    expect(c2.row.done).toBe(false);

    // Reopen fails
    const fail2 = settleFailure(state, c2.row, 2, {
      done: false,
      done_at: null,
    });
    expect(fail2.rolledBack).toBe(true);
    expect(fail2.row.done).toBe(true); // back to confirmed true (server's truth)!
    expect(fail2.row.done_at).toBe("2026-10-31T09:00:00Z");
  });

  it("registers initial row as confirmed on first beginChange if not already present", () => {
    const initial = makeTask({ id: "unregistered", done: false });
    const state = createTaskSyncState();
    const c = beginChange(state, initial, 1, { done: true });
    expect(c.state.confirmed.get("unregistered")).toEqual(initial);
  });
});
