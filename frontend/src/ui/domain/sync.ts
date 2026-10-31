import type { Task } from "./types";

/** Owned by useTaskSync's ref; the functions below update it in place and return a new row. */
export interface TaskSyncState {
  confirmed: Map<string, Task>;
  writers: Map<string, Map<keyof Task, number>>;
}

export function createTaskSyncState(initialTasks?: Task[]): TaskSyncState {
  const confirmed = new Map<string, Task>();
  if (initialTasks) {
    for (const task of initialTasks) {
      confirmed.set(task.id, task);
    }
  }
  return {
    confirmed,
    writers: new Map(),
  };
}

/** Registers confirmed if not present, applies fields, and sets writers to seq. */
export function beginChange(
  state: TaskSyncState,
  row: Task,
  seq: number,
  fields: Partial<Task>,
): { state: TaskSyncState; row: Task } {
  if (!state.confirmed.has(row.id)) {
    state.confirmed.set(row.id, row);
  }

  let taskWriters = state.writers.get(row.id);
  if (!taskWriters) {
    taskWriters = new Map<keyof Task, number>();
    state.writers.set(row.id, taskWriters);
  }

  for (const key of Object.keys(fields) as Array<keyof Task>) {
    taskWriters.set(key, seq);
  }

  return {
    state,
    row: { ...row, ...fields },
  };
}

/** Success keeps newer writers. */
export function settleSuccess(
  state: TaskSyncState,
  row: Task,
  seq: number,
  saved: Task,
): { state: TaskSyncState; row: Task } {
  state.confirmed.set(saved.id, saved);
  const taskWriters = state.writers.get(row.id);
  const nextRow: Task = { ...saved };

  if (taskWriters) {
    for (const [key, writerSeq] of taskWriters.entries()) {
      if (writerSeq > seq) {
        Object.assign(nextRow, { [key]: row[key] });
      } else {
        taskWriters.delete(key);
      }
    }
    if (taskWriters.size === 0) {
      state.writers.delete(row.id);
    }
  }

  return { state, row: nextRow };
}

/** Failure rolls back only fields this request still owns. */
export function settleFailure(
  state: TaskSyncState,
  row: Task,
  seq: number,
  fields: Partial<Task>,
): { state: TaskSyncState; row: Task; rolledBack: boolean } {
  const confirmed = state.confirmed.get(row.id) ?? row;
  const taskWriters = state.writers.get(row.id);
  let rolledBack = false;
  const nextRow: Task = { ...row };

  if (taskWriters) {
    for (const key of Object.keys(fields) as Array<keyof Task>) {
      if (taskWriters.get(key) === seq) {
        Object.assign(nextRow, { [key]: confirmed[key] });
        taskWriters.delete(key);
        rolledBack = true;
      }
    }
    if (taskWriters.size === 0) {
      state.writers.delete(row.id);
    }
  }

  return { state, row: nextRow, rolledBack };
}
