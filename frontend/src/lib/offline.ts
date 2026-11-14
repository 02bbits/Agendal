import { ApiRequestError } from "./apiError";
import { now } from "./clock";
import {
  enqueue,
  putProject,
  putTasks,
  queueSize,
  readProject,
  readTask,
  readTasks,
  removeProject,
  removeTasks,
  type QueueEntry,
} from "./localStore";
import type { TaskPatch } from "../ui/domain/api";
import type { CreateTaskBody } from "../ui/domain/newTask";
import type { Project, ProjectColor, Task } from "../ui/domain/types";

// Offline edits (AP-2, ADR-004): a write that gets no answer is queued as field patches and
// applied to the device copy, so the screen keeps it and sync pushes it later. Nothing turns
// read-only (UX-40). A server refusal (`ApiRequestError`) still fails the call as before.

/** Asks the sync loop to push soon (`lib/sync` listens). */
export const SYNC_REQUEST = "agendal:sync-request";

/** What a write leaves on the device, or null when the row isn't there to edit. */
type Local<T> = () => Promise<{ value: T } | null>;

// Deleted while offline: kept so Undo can bring them back before sync
const trashed = new Map<string, Task | Project>();

const nowIso = () => now().toISOString();

/**
 * Runs `request`, or queues `entries` when it gets no answer. While edits already wait, new ones
 * queue behind them, so the server sees them in order (OFF-13).
 */
export async function orQueue<T>(
  request: () => Promise<T>,
  entries: QueueEntry[],
  local: Local<T>,
): Promise<T> {
  if ((await queueSize()) === 0) {
    try {
      return await request();
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      const kept = await queue(entries, local);
      if (!kept) throw error;
      return kept.value;
    }
  }
  const kept = await queue(entries, local);
  return kept ? kept.value : request();
}

async function queue<T>(entries: QueueEntry[], local: Local<T>) {
  const kept = await local();
  if (!kept || !(await enqueue(entries))) return null;
  window.dispatchEvent(new Event(SYNC_REQUEST));
  return kept;
}

const patchRows = (
  entity: "task" | "project",
  id: string,
  fields: object,
  at: string,
): QueueEntry[] =>
  Object.entries(fields).map(([field, value]) => ({
    kind: "patch",
    entity,
    id,
    field,
    value,
    at,
  }));

async function editTask(id: string, change: Partial<Task>) {
  const task = await readTask(id);
  if (!task) return null;
  const edited = { ...task, ...change, updated_at: nowIso() };
  await putTasks([edited]);
  return edited;
}

export const offlineTask = {
  patch: (id: string, fields: TaskPatch, at: string) => ({
    entries: patchRows("task", id, fields, at),
    local: async () => {
      const task = await editTask(id, fields);
      return task && { value: task };
    },
  }),

  /** Complete or reopen. A repeating task's next occurrence comes from the server on sync (TK-E7). */
  lifecycle: (id: string, done: boolean, at: string) => ({
    entries: patchRows("task", id, { done }, at),
    local: async () => {
      const task = await editTask(id, { done, done_at: done ? at : null });
      return task && { value: { task } };
    },
  }),

  remove: (id: string) => ({
    entries: patchRows("task", id, { deleted: true }, nowIso()),
    local: async () => {
      const task = await readTask(id);
      if (task) trashed.set(id, task);
      await removeTasks([id]);
      return { value: undefined };
    },
  }),

  restore: (id: string) => ({
    entries: patchRows("task", id, { deleted: false }, nowIso()),
    local: async () => {
      const task =
        (trashed.get(id) as Task | undefined) ?? (await readTask(id));
      if (!task) return null;
      await putTasks([task]);
      return { value: task };
    },
  }),

  create: (body: CreateTaskBody) => ({
    entries: [{ kind: "create", entity: "task", body }] as QueueEntry[],
    local: async () => {
      const task: Task = {
        start_date: null,
        due_date: null,
        start_time: null,
        due_time: null,
        priority: null,
        project_id: null,
        repeat: "never",
        reminder: "none",
        notes: null,
        done: false,
        done_at: null,
        created_by: "user",
        created_at: nowIso(),
        // Fields the form left out stay at their defaults
        ...Object.fromEntries(
          Object.entries(body).filter(([, value]) => value !== undefined),
        ),
      } as Task;
      await putTasks([task]);
      return { value: task };
    },
  }),
};

export const offlineProject = {
  create: (body: { id: string; name: string; colour: ProjectColor }) => ({
    entries: [{ kind: "create", entity: "project", body }] as QueueEntry[],
    local: async () => {
      const project = { ...body, created_at: nowIso(), open: 0, done: 0 };
      await putProject(project);
      return { value: project as Project };
    },
  }),

  update: (id: string, fields: object) => ({
    entries: patchRows("project", id, fields, nowIso()),
    local: async () => {
      const project = await readProject(id);
      if (!project) return null;
      const edited = { ...project, ...fields };
      await putProject(edited);
      return { value: edited };
    },
  }),

  /** `deleted` names what happens to its tasks, as the delete dialog does (PJ §8). */
  remove: (id: string, mode: "move" | "delete" = "move") => ({
    entries: patchRows("project", id, { deleted: mode }, nowIso()),
    local: async () => {
      const project = await readProject(id);
      if (project) trashed.set(id, project);
      await removeProject(id);
      const tasks = (await readTasks()).filter((t) => t.project_id === id);
      if (mode === "delete") {
        tasks.forEach((task) => trashed.set(task.id, task));
        await removeTasks(tasks.map((task) => task.id));
      } else
        await putTasks(tasks.map((task) => ({ ...task, project_id: null })));
      return {
        value: { undo: { task_ids: tasks.map((task) => task.id), mode } },
      };
    },
  }),

  restore: (id: string, taskIds: string[], mode: "move" | "delete") => ({
    entries: [
      ...patchRows("project", id, { deleted: false }, nowIso()),
      ...taskIds.flatMap((taskId) =>
        patchRows(
          "task",
          taskId,
          mode === "move" ? { project_id: id } : { deleted: false },
          nowIso(),
        ),
      ),
    ],
    local: async () => {
      const project =
        (trashed.get(id) as Project | undefined) ?? (await readProject(id));
      if (!project) return null;
      await putProject(project);
      const tasks = await Promise.all(
        taskIds.map(async (taskId) => {
          if (mode === "delete") return trashed.get(taskId) as Task | undefined;
          const task = await readTask(taskId);
          return task && { ...task, project_id: id };
        }),
      );
      await putTasks(tasks);
      return { value: project };
    },
  }),
};
