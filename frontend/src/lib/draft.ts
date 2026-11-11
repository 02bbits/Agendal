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

// IndexedDB can't finish a write as the page goes: the browser aborts it. So when the page is
// hidden the text is also put in localStorage, which writes at once, and the next open moves it
// back here (NC-E1). Sign-out wipes both (NF-19).
const HIDDEN_COPY = "agendal.draft.hidden";

function readCopy(): string | null {
  try {
    return localStorage.getItem(HIDDEN_COPY);
  } catch {
    return null;
  }
}

function dropCopy(): void {
  try {
    localStorage.removeItem(HIDDEN_COPY);
  } catch {
    // Storage blocked: there is no copy to drop
  }
}

/** For pagehide and a hidden page: keeps the text where an unloading page can still write. */
export function keepDraftOnHide(text: string): void {
  try {
    if (text.trim()) localStorage.setItem(HIDDEN_COPY, text);
    else localStorage.removeItem(HIDDEN_COPY);
  } catch {
    // Storage full or blocked: the last IndexedDB save is what comes back
  }
}

export async function loadDraft(): Promise<string> {
  const copy = readCopy();
  // The copy is newer: it was written as the page went, after the last save here
  if (copy !== null) {
    await saveDraft(copy);
    return copy;
  }
  return (await run<string | undefined>("readonly", (s) => s.get(KEY))) ?? "";
}

/** Saves the text; nothing visible left deletes the draft. */
export async function saveDraft(text: string): Promise<void> {
  if (!text.trim()) return clearDraft();
  await run("readwrite", (s) => s.put(text, KEY));
  // Saved here now; a copy of other, later text stays until it is saved too
  if (readCopy() === text) dropCopy();
}

export async function clearDraft(): Promise<void> {
  dropCopy();
  await run("readwrite", (s) => s.delete(KEY));
}
