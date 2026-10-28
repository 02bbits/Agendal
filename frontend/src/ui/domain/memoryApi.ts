import type { TaskApi } from "./api";
import { nextOccurrence } from "./repeat";
import type { Project, Task } from "./types";
import { uuidv7 } from "./uuid";

export interface MemoryDb {
  tasks: Task[];
  projects: Project[];
}

/**
 * In-memory TaskApi for mocks, demos and component tests until the Laravel
 * endpoints land. `fail` makes the next call reject, to exercise revert paths.
 */
export function createMemoryApi(
  seed: Partial<MemoryDb> = {},
  opts: { today: () => string } = {
    today: () => new Date().toISOString().slice(0, 10),
  },
) {
  const db: MemoryDb = {
    tasks: structuredClone(seed.tasks ?? []),
    projects: structuredClone(seed.projects ?? []),
  };
  const deleted = new Map<string, Task>();
  const deletedProjects = new Map<
    string,
    { project: Project; taskIds: string[]; action: "move" | "delete" }
  >();
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
    async create(input) {
      await guard();
      const known = db.tasks.find((t) => t.id === input.id);
      if (known) return { ...known };
      const now = new Date().toISOString();
      const task: Task = {
        due_date: null,
        start_time: null,
        end_time: null,
        priority: "low",
        project_id: null,
        repeat: "never",
        reminder: "none",
        notes: null,
        done: false,
        done_at: null,
        created_by: "user",
        created_at: now,
        updated_at: now,
        ...input,
      };
      db.tasks.push(task);
      return { ...task };
    },
    async complete(id, at) {
      await guard();
      const task = find(id);
      const first = !task.done;
      Object.assign(task, { done: true, done_at: at, updated_at: at });
      // One next occurrence per completion: unique on previous_occurrence_id (TK-E7)
      const exists = db.tasks.some((t) => t.previous_occurrence_id === id);
      const next =
        first && !exists
          ? nextOccurrence(task, opts.today(), uuidv7(), at)
          : null;
      if (next) db.tasks.push(next);
      return next
        ? { task: { ...task }, next: { ...next } }
        : { task: { ...task } };
    },
    async reopen(id, at) {
      await guard();
      const task = find(id);
      Object.assign(task, { done: false, done_at: null, updated_at: at });
      // Undo of a completion also removes the occurrence it made, if still untouched (TK-E6)
      const next = db.tasks.find(
        (t) => t.previous_occurrence_id === id && !t.done,
      );
      if (next) db.tasks.splice(db.tasks.indexOf(next), 1);
      return next
        ? { task: { ...task }, removedNextId: next.id }
        : { task: { ...task } };
    },
    async remove(id, scope) {
      await guard();
      const task = find(id);
      if (task.repeat !== "never" && !scope)
        throw Object.assign(new Error("scope required"), { status: 422 });
      db.tasks.splice(db.tasks.indexOf(task), 1);
      deleted.set(id, task);
      const next =
        scope === "one" && !task.done
          ? nextOccurrence(
              task,
              opts.today(),
              uuidv7(),
              new Date().toISOString(),
            )
          : null;
      if (next) db.tasks.push(next);
      return next ? { next: { ...next } } : {};
    },
    async restore(id) {
      await guard();
      const task = deleted.get(id);
      if (!task) throw Object.assign(new Error("task.purged"), { status: 409 });
      deleted.delete(id);
      // Restoring after "This task only" takes back the occurrence that delete made
      const made = db.tasks.findIndex(
        (t) => t.previous_occurrence_id === id && !t.done,
      );
      if (made >= 0) db.tasks.splice(made, 1);
      db.tasks.push(task);
      return { ...task };
    },
    async createProject(input) {
      await guard();
      const known = db.projects.find((p) => p.id === input.id);
      if (known) return { ...known };
      if (db.projects.length >= 50)
        throw Object.assign(new Error("project.limit"), { status: 422 });
      if (
        db.projects.some(
          (p) =>
            p.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
        )
      ) {
        throw Object.assign(new Error("project.name_taken"), { status: 422 });
      }
      const project: Project = {
        ...input,
        created_at: new Date().toISOString(),
      };
      db.projects.push(project);
      return { ...project };
    },
    async removeProject(id, action) {
      await guard();
      const project = db.projects.find((p) => p.id === id);
      if (!project)
        throw Object.assign(new Error("not found"), { status: 404 });
      db.projects.splice(db.projects.indexOf(project), 1);
      const mine = db.tasks.filter((t) => t.project_id === id);
      for (const task of mine) {
        if (action === "move") task.project_id = null;
        else {
          db.tasks.splice(db.tasks.indexOf(task), 1);
          deleted.set(task.id, task);
        }
      }
      deletedProjects.set(id, {
        project,
        taskIds: mine.map((t) => t.id),
        action,
      });
    },
    async restoreProject(id) {
      await guard();
      const entry = deletedProjects.get(id);
      if (!entry)
        throw Object.assign(new Error("project.purged"), { status: 409 });
      deletedProjects.delete(id);
      db.projects.push(entry.project);
      const tasks: Task[] = [];
      for (const taskId of entry.taskIds) {
        const task =
          entry.action === "move"
            ? db.tasks.find((t) => t.id === taskId)
            : deleted.get(taskId);
        if (!task) continue;
        task.project_id = id;
        if (entry.action === "delete") {
          deleted.delete(taskId);
          db.tasks.push(task);
        }
        tasks.push({ ...task });
      }
      return { project: { ...entry.project }, tasks };
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
