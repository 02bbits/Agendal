import type {
  NoteListEntry,
  NoteResult,
  Project,
  Task,
} from "../ui/domain/types";

// The device copy of the account's data (AP-2, AP §2.2): tasks, projects, settings, the last 100
// notes, and the queue of edits made offline. Lists and the note screen read it first, so they
// open offline; sync (IM-52) keeps it up to date. Sign-out and a different account wipe it
// (`wipeDevice`, `claimDevice`).
const DB = "agendal";
const TASKS = "tasks";
const PROJECTS = "projects";
const SETTINGS = "settings";
const NOTES = "notes";
const QUEUE = "queue";
/** AP §2.2: the device keeps the last 100 notes. */
export const KEEP_NOTES = 100;
const ME = "me";

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        db.createObjectStore(TASKS, { keyPath: "id" });
        db.createObjectStore(PROJECTS, { keyPath: "id" });
        db.createObjectStore(SETTINGS);
        db.createObjectStore(NOTES, { keyPath: "id" });
      }
      // v2 (IM-52): edits waiting for sync, oldest first
      if (event.oldVersion < 2)
        db.createObjectStore(QUEUE, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// One transaction per call. Storage blocked or full (private mode, AP-E11): the app keeps
// working online, so a failure resolves with `fallback` instead of throwing.
async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
  fallback: T,
): Promise<T> {
  try {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(request ? request.result : fallback);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return fallback;
  }
}

export const readTasks = () =>
  run<Task[]>(TASKS, "readonly", (s) => s.getAll(), []);

export const putTasks = (tasks: readonly (Task | undefined)[]) =>
  run<void>(
    TASKS,
    "readwrite",
    (s) => tasks.forEach((task) => task && s.put(task)),
    undefined,
  );

export const removeTasks = (ids: readonly string[]) =>
  run<void>(
    TASKS,
    "readwrite",
    (s) => ids.forEach((id) => s.delete(id)),
    undefined,
  );

export const readProjects = () =>
  run<Project[]>(PROJECTS, "readonly", (s) => s.getAll(), []);

export const putProject = (project: Project) =>
  run<void>(PROJECTS, "readwrite", (s) => void s.put(project), undefined);

export const removeProject = (id: string) =>
  run<void>(PROJECTS, "readwrite", (s) => void s.delete(id), undefined);

/** `GET /projects` lists every project, so it replaces the stored ones. */
export const replaceProjects = (projects: readonly Project[]) =>
  run<void>(
    PROJECTS,
    "readwrite",
    (s) => {
      s.clear();
      projects.forEach((project) => s.put(project));
    },
    undefined,
  );

export const readMe = <T>() =>
  run<T | undefined>(SETTINGS, "readonly", (s) => s.get(ME), undefined);

export const saveMe = (me: unknown) =>
  run<void>(SETTINGS, "readwrite", (s) => void s.put(me, ME), undefined);

// A note on the device: its Notes row, and its full result once one was seen (the note screen)
type StoredNote = NoteListEntry & { result?: NoteResult };

const newestFirst = (a: StoredNote, b: StoredNote) =>
  b.written_at.localeCompare(a.written_at) || b.id.localeCompare(a.id);

/** The Notes row a result stands for, as `GET /notes` would list it. */
function entryOf({ note, changes }: NoteResult): NoteListEntry {
  const count = (kind: string) => changes.filter((c) => c.kind === kind).length;
  return {
    id: note.id,
    status: note.status,
    name: note.name,
    excerpt: note.text.slice(0, 140),
    written_at: note.written_at,
    edited_at: note.edited_at ?? null,
    source_file_name: note.source_file_name,
    counts: {
      created: count("created"),
      updated: count("updated"),
      deleted: count("deleted"),
    },
  };
}

// Merges into what's stored (a list row doesn't drop a kept result), then keeps the newest 100
async function putNotes(notes: readonly StoredNote[]) {
  await run<void>(
    NOTES,
    "readwrite",
    (s) =>
      notes.forEach((note) => {
        const stored = s.get(note.id);
        stored.onsuccess = () => s.put({ ...stored.result, ...note });
      }),
    undefined,
  );
  await run<void>(
    NOTES,
    "readwrite",
    (s) => {
      const all = s.getAll();
      all.onsuccess = () =>
        (all.result as StoredNote[])
          .sort(newestFirst)
          .slice(KEEP_NOTES)
          .forEach((note) => s.delete(note.id));
    },
    undefined,
  );
}

export const putNoteEntries = (entries: readonly NoteListEntry[]) =>
  putNotes(entries);

export const putNoteResult = (result: NoteResult) =>
  putNotes([{ ...entryOf(result), result }]);

/** The Notes rows on the device, newest first. */
export async function readNoteEntries(): Promise<NoteListEntry[]> {
  const all = await run<StoredNote[]>(NOTES, "readonly", (s) => s.getAll(), []);
  // Rows only: the full results stay in the store until a note is opened
  return all.sort(newestFirst).map((note) => {
    const entry: StoredNote = { ...note };
    delete entry.result;
    return entry;
  });
}

export async function readNoteResult(id: string) {
  const note = await run<StoredNote | undefined>(
    NOTES,
    "readonly",
    (s) => s.get(id),
    undefined,
  );
  return note?.result;
}

export const removeNote = (id: string) =>
  run<void>(NOTES, "readwrite", (s) => void s.delete(id), undefined);

// Sync bookkeeping (IM-52): the pull cursor and the tasks that lost a conflict
export const readSetting = <T>(key: string) =>
  run<T | undefined>(SETTINGS, "readonly", (s) => s.get(key), undefined);

export const saveSetting = (key: string, value: unknown) =>
  run<void>(SETTINGS, "readwrite", (s) => void s.put(value, key), undefined);

/** One offline edit (ADR-004): a field patch, or a create replayed through `POST /tasks|/projects`. */
export type QueueEntry =
  | {
      kind: "patch";
      entity: "task" | "project";
      id: string;
      field: string;
      value: unknown;
      at: string;
    }
  | { kind: "create"; entity: "task" | "project"; body: object };

/** Adds edits to the queue. False when the device can't store them (storage blocked). */
export const enqueue = async (entries: readonly QueueEntry[]) =>
  (await run<number>(
    QUEUE,
    "readwrite",
    (s) => {
      entries.forEach((entry) => s.add(entry));
      // Read in the same transaction: a number means the adds landed
      return s.count();
    },
    -1,
  )) >= 0;

/** The queue, oldest first, with each entry's key. */
export async function readQueue(): Promise<
  Array<{ key: number; entry: QueueEntry }>
> {
  let keys: IDBValidKey[] = [];
  // Keys and values in one transaction, so an edit queued meanwhile can't shift them apart
  const entries = await run<QueueEntry[]>(
    QUEUE,
    "readonly",
    (s) => {
      const keyRequest = s.getAllKeys();
      keyRequest.onsuccess = () => (keys = keyRequest.result);
      return s.getAll();
    },
    [],
  );
  return entries.map((entry, i) => ({ key: keys[i] as number, entry }));
}

export const queueSize = () =>
  run<number>(QUEUE, "readonly", (s) => s.count(), 0);

export const dropQueue = (keys: readonly number[]) =>
  run<void>(
    QUEUE,
    "readwrite",
    (s) => keys.forEach((key) => s.delete(key)),
    undefined,
  );

/** Before a full resync (`410`): drop the device copy, never the queue. */
export async function clearData() {
  for (const store of [TASKS, PROJECTS, NOTES])
    await run<void>(store, "readwrite", (s) => void s.clear(), undefined);
}

export const removeProjects = (ids: readonly string[]) =>
  run<void>(
    PROJECTS,
    "readwrite",
    (s) => ids.forEach((id) => s.delete(id)),
    undefined,
  );

export const removeNotes = (ids: readonly string[]) =>
  run<void>(
    NOTES,
    "readwrite",
    (s) => ids.forEach((id) => s.delete(id)),
    undefined,
  );

export const readTask = (id: string) =>
  run<Task | undefined>(TASKS, "readonly", (s) => s.get(id), undefined);

export const readProject = (id: string) =>
  run<Project | undefined>(PROJECTS, "readonly", (s) => s.get(id), undefined);
