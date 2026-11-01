import type { TaskApi, TaskPatch } from "../../src/ui/domain/api";
import type { Project, Task } from "../../src/ui/domain/types";

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
    async patch(id, fields, at) {
      await guard();
      const task = find(id);
      const merged = { ...task, ...fields };
      if (
        merged.start_time &&
        merged.end_time &&
        merged.end_time <= merged.start_time
      ) {
        throw Object.assign(new Error("task.end_before_start"), {
          status: 422,
        });
      }
      Object.assign(task, fields, { updated_at: at });
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

export interface DeferredCall {
  type: "complete" | "reopen" | "patch";
  id: string;
  at: string;
  patch?: TaskPatch;
  resolve: (value?: { task: Task; next?: Task } | Task) => void;
  reject: (error?: unknown) => void;
  promise: Promise<{ task: Task; next?: Task } | Task>;
}

export function deferredApi(seed: Partial<MemoryDb> = {}) {
  const db: MemoryDb = {
    tasks: structuredClone(seed.tasks ?? []),
    projects: structuredClone(seed.projects ?? []),
  };
  const calls: DeferredCall[] = [];

  const find = (id: string) => {
    const task = db.tasks.find((t) => t.id === id);
    if (!task) throw Object.assign(new Error("not found"), { status: 404 });
    return task;
  };

  const createLifecycleCall = (
    type: "complete" | "reopen",
    id: string,
    at: string,
  ): Promise<{ task: Task; next?: Task }> => {
    let resolvePromise!: (value: { task: Task; next?: Task }) => void;
    let rejectPromise!: (error: unknown) => void;
    const promise = new Promise<{ task: Task; next?: Task }>((res, rej) => {
      resolvePromise = res;
      rejectPromise = rej;
    });

    const call: DeferredCall = {
      type,
      id,
      at,
      promise,
      resolve(value) {
        if (value && "task" in value) {
          resolvePromise(value);
        } else {
          const task = find(id);
          Object.assign(task, {
            done: type === "complete",
            done_at: type === "complete" ? at : null,
            updated_at: at,
          });
          resolvePromise({ task: { ...task } });
        }
      },
      reject(error) {
        rejectPromise(
          error ?? Object.assign(new Error("save failed"), { status: 500 }),
        );
      },
    };

    calls.push(call);
    return promise;
  };

  const api: TaskApi = {
    complete(id, at) {
      return createLifecycleCall("complete", id, at);
    },
    reopen(id, at) {
      return createLifecycleCall("reopen", id, at);
    },
    patch(id: string, fields: TaskPatch, at: string): Promise<Task> {
      let resolvePromise!: (value: Task) => void;
      let rejectPromise!: (error: unknown) => void;
      const promise = new Promise<Task>((res, rej) => {
        resolvePromise = res;
        rejectPromise = rej;
      });

      const call: DeferredCall = {
        type: "patch",
        id,
        at,
        patch: fields,
        promise,
        resolve(value) {
          if (value && "id" in value) {
            resolvePromise(value as Task);
          } else {
            const task = find(id);
            Object.assign(task, fields, { updated_at: at });
            resolvePromise({ ...task });
          }
        },
        reject(error) {
          rejectPromise(
            error ?? Object.assign(new Error("save failed"), { status: 500 }),
          );
        },
      };

      calls.push(call);
      return promise;
    },
  };

  return {
    api,
    db,
    calls,
  };
}
