import type { TaskApi } from "./api";
import type { Project, Task } from "./types";

export interface MemoryDb {
  tasks: Task[];
  projects: Project[];
}

/**
 * In-memory TaskApi for mocks, demos and component tests until the Laravel
 * endpoints land. `fail` makes the next call reject, to exercise revert paths.
 */
export function createMemoryApi(seed: Partial<MemoryDb> = {}) {
  const db: MemoryDb = {
    tasks: structuredClone(seed.tasks ?? []),
    projects: structuredClone(seed.projects ?? []),
  };
  let failNext = false;

  const find = (id: string) => {
    const task = db.tasks.find((t) => t.id === id);
    if (!task) throw Object.assign(new Error("not found"), { status: 404 });
    return task;
  };
  const guard = async () => {
    if (failNext) {
      failNext = false;
      throw Object.assign(new Error("save failed"), { status: 500 });
    }
  };

  const api: TaskApi = {
    async complete(id, at) {
      await guard();
      const task = find(id);
      Object.assign(task, { done: true, done_at: at, updated_at: at });
      return { task: { ...task } };
    },
    async reopen(id, at) {
      await guard();
      const task = find(id);
      Object.assign(task, { done: false, done_at: null, updated_at: at });
      return { task: { ...task } };
    },
    async get(id) {
      await guard();
      return { ...find(id) };
    },
    async patch(id, patch, at) {
      await guard();
      const task = find(id);
      const merged = { ...task, ...patch };
      if (
        merged.start_time &&
        merged.end_time &&
        merged.end_time <= merged.start_time
      ) {
        throw Object.assign(new Error("task.end_before_start"), {
          status: 422,
        });
      }
      Object.assign(task, patch, { updated_at: at });
      return { ...task };
    },
  };

  return {
    api,
    db,
    fail() {
      failNext = true;
    },
  };
}
