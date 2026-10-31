// The unsent note (UX-13, NC §2.1): one draft per device, in IndexedDB so sign-out wipes it (NF-19).
// A database of its own, so the offline queue can version its schema without touching this one.
const DB = "agendal-drafts";
const STORE = "drafts";
const KEY = "note";

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operation(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDraft(): Promise<string> {
  return (await run<string | undefined>("readonly", (s) => s.get(KEY))) ?? "";
}

/** Saves the text; nothing visible left deletes the draft. */
export async function saveDraft(text: string): Promise<void> {
  await (text.trim()
    ? run("readwrite", (s) => s.put(text, KEY))
    : clearDraft());
}

export async function clearDraft(): Promise<void> {
  await run("readwrite", (s) => s.delete(KEY));
}
