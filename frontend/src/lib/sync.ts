import { api } from "./api";
import { ApiRequestError, handleResponse } from "./apiError";
import { now } from "./clock";
import { markConflict } from "./conflicts";
import {
  clearData,
  dropQueue,
  putNoteEntries,
  putProject,
  putTasks,
  readQueue,
  readSetting,
  readTask,
  removeNotes,
  removeProjects,
  removeTasks,
  saveSetting,
  type QueueEntry,
} from "./localStore";
import { SYNC_REQUEST } from "./offline";
import { getTask } from "./taskApi";
import type { NoteListEntry, Project, Task } from "../ui/domain/types";

// Sync (ADR-005, AP §2.2): push the queued edits, then pull what changed elsewhere. One tab at a
// time (Web Locks); the others hear about it on a BroadcastChannel (AP-E3).

/** Fired on `window` after a sync brought or sent changes: lists load again. */
export const SYNCED = "agendal:synced";
const CHANNEL = "agendal-sync";
const CURSOR = "cursor";
const BATCH = 500;
const KEEP_COMPLETED_DAYS = 90;
const EVERY_MS = 60_000;
/** AP §2.2 retry: 1 s, 5 s, 30 s, then 60 s, each ±20 %. */
const BACKOFF_MS = [1_000, 5_000, 30_000, 60_000];

type Tombstone = { deleted_at?: string | null };
interface PullPage {
  changes: {
    tasks: Array<Task & Tombstone>;
    projects: Array<Project & Tombstone>;
    notes: Array<NoteListEntry & Tombstone>;
  };
  next_cursor: number;
  has_more: boolean;
}
type Patch = Extract<QueueEntry, { kind: "patch" }>;
interface PatchResult {
  index: number;
  status: "applied" | "stale" | "rejected";
  current?: unknown;
}

let running: Promise<boolean> | null = null;

/**
 * One sync. True when it finished (or another tab is syncing), false when the network failed and
 * it should be retried.
 */
export function syncNow(): Promise<boolean> {
  running ??= locked().finally(() => (running = null));
  return running;
}

async function locked(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.locks) return run();
  // Another tab holds it: that tab syncs and tells this one (OFF-11). The DOM types don't unwrap
  // the callback's promise, but the lock does
  return (await navigator.locks.request(
    "sync",
    { ifAvailable: true },
    async (lock) => (lock ? run() : true),
  )) as boolean;
}

async function run(): Promise<boolean> {
  try {
    const pushed = await push();
    const pulled = await pull();
    if (pushed || pulled) announce();
    return true;
  } catch (error) {
    // No answer, a server error or a rate limit: retry with backoff. Any other refusal is the
    // server's answer, and retrying sooner wouldn't change it
    return (
      error instanceof ApiRequestError &&
      error.status < 500 &&
      error.status !== 429
    );
  }
}

/** Sends the queue, oldest first: creates through their endpoints, then field patches in batches. */
async function push(): Promise<boolean> {
  const queue = await readQueue();
  if (queue.length === 0) return false;
  for (const { key, entry } of queue) {
    if (entry.kind !== "create") continue;
    try {
      await handleResponse(
        await api(entry.entity === "task" ? "/tasks" : "/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry.body),
        }),
      );
    } catch (error) {
      // Refused (e.g. the open-task limit): it can never land, so it leaves the queue
      if (!(error instanceof ApiRequestError)) throw error;
    }
    await dropQueue([key]);
  }

  const patches = queue.filter(
    (item): item is { key: number; entry: Patch } =>
      item.entry.kind === "patch",
  );
  for (let start = 0; start < patches.length; start += BATCH) {
    const batch = patches.slice(start, start + BATCH);
    const { results } = await handleResponse<{ results: PatchResult[] }>(
      await api("/sync/patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          batch.map(({ entry: { entity, id, field, value, at } }) => ({
            entity,
            id,
            field,
            value,
            at,
          })),
        ),
      }),
    );
    for (const result of results) {
      const patch = batch[result.index]!.entry;
      if (result.status === "stale") await lost(patch, result.current);
      // Refused (e.g. start after due): the device takes the server's value back
      else if (result.status === "rejected" && "current" in result)
        await takeServerValue(patch, result.current);
    }
    await dropQueue(batch.map(({ key }) => key));
  }
  return true;
}

/** A later edit elsewhere won (AP-E7, TK-E8): take the server's value and say so. */
async function lost(patch: Patch, current: unknown) {
  if (patch.entity !== "task") return;
  const task = await readTask(patch.id);
  await takeServerValue(patch, current);
  if (JSON.stringify(current) !== JSON.stringify(patch.value))
    await markConflict(patch.id, task?.title ?? "");
}

async function takeServerValue(patch: Patch, current: unknown) {
  if (patch.entity !== "task") return;
  if (patch.field === "deleted") {
    // Deleted there, or alive there after this device deleted it: bring the device in line
    if (current === true) await removeTasks([patch.id]);
    else await getTask(patch.id).catch(() => undefined);
    return;
  }
  const task = await readTask(patch.id);
  if (task) await putTasks([{ ...task, [patch.field]: current }]);
}

/** Pulls from the stored cursor; a `410` drops the device copy and downloads it again (OFF-15). */
async function pull(): Promise<boolean> {
  const saved = await readSetting<number>(CURSOR);
  try {
    return await pullFrom(saved ?? 0, saved === undefined);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 410)
      throw error;
    await clearData();
    return pullFrom(0, true);
  }
}

async function pullFrom(cursor: number, full: boolean): Promise<boolean> {
  let changed = false;
  for (;;) {
    const query = new URLSearchParams({
      cursor: String(cursor),
      limit: String(BATCH),
    });
    if (full) query.set("full", "1");
    const page = await handleResponse<PullPage>(await api(`/sync?${query}`));
    // Every page is applied: `||=` would skip the rest once one changed something
    changed = (await apply(page.changes)) || changed;
    cursor = page.next_cursor;
    await saveSetting(CURSOR, cursor);
    if (!page.has_more) return changed;
  }
}

async function apply({ tasks, projects, notes }: PullPage["changes"]) {
  const oldest = new Date(
    now().getTime() - KEEP_COMPLETED_DAYS * 86_400_000,
  ).toISOString();
  // The device keeps open tasks and those completed in the last 90 days (AP §2.2)
  const gone = (task: Task & Tombstone) =>
    !!task.deleted_at || (task.done && (task.done_at ?? "") < oldest);
  await removeTasks(tasks.filter(gone).map((task) => task.id));
  await putTasks(tasks.filter((task) => !gone(task)).map(strip));
  await removeProjects(projects.filter((p) => p.deleted_at).map((p) => p.id));
  for (const project of projects.filter((p) => !p.deleted_at))
    await putProject(strip(project));
  await removeNotes(notes.filter((n) => n.deleted_at).map((n) => n.id));
  await putNoteEntries(notes.filter((n) => !n.deleted_at).map(strip));
  return tasks.length + projects.length + notes.length > 0;
}

function strip<T extends Tombstone>(row: T) {
  const kept = { ...row };
  delete kept.deleted_at;
  return kept as Omit<T, "deleted_at">;
}

/** How long to wait after the `failures`-th failure in a row: 1 s, 5 s, 30 s, then 60 s, ±20 %. */
export function retryDelay(failures: number, random = Math.random()) {
  const base = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]!;
  return base * (0.8 + random * 0.4);
}

let channel: BroadcastChannel | null = null;

function announce() {
  window.dispatchEvent(new Event(SYNCED));
  channel?.postMessage("synced");
}

/**
 * Keeps the device in sync while signed in (ADR-005): now, on reconnect, when the tab becomes
 * visible, when an edit is queued, and every 60 s while visible. A failure retries with backoff.
 * Returns the stop function (sign-out).
 */
export function startSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let stopped = false;

  const schedule = (ms: number) => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(tick, ms);
  };
  async function tick() {
    if (stopped || document.visibilityState === "hidden") return;
    const ok = await syncNow();
    failures = ok ? 0 : failures + 1;
    schedule(ok ? EVERY_MS : retryDelay(failures));
  }
  const soon = () => schedule(0);
  const onVisible = () => {
    if (document.visibilityState === "visible") soon();
  };

  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => window.dispatchEvent(new Event(SYNCED));
  }
  window.addEventListener("online", soon);
  window.addEventListener(SYNC_REQUEST, soon);
  document.addEventListener("visibilitychange", onVisible);
  soon();

  return () => {
    stopped = true;
    clearTimeout(timer);
    channel?.close();
    channel = null;
    window.removeEventListener("online", soon);
    window.removeEventListener(SYNC_REQUEST, soon);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
