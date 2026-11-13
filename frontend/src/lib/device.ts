const deleteDatabase = (name: string) =>
  new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    // Blocked: the browser deletes it once the last open connection closes
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });

// Wipes everything the account left on this device: IndexedDB, service-worker caches, the
// draft and per-device preferences (SC-19, NF-19). Sign out uses it, and so will AA-E7.
export async function wipeDevice() {
  const databases = (await indexedDB?.databases?.()) ?? [];
  const cacheNames = "caches" in window ? await caches.keys() : [];
  await Promise.all([
    ...databases.flatMap(({ name }) => (name ? [deleteDatabase(name)] : [])),
    ...cacheNames.map((name) => caches.delete(name)),
  ]);
  localStorage.clear();
  sessionStorage.clear();
}

const USER_KEY = "agendal.user_id";

/**
 * Marks this device as holding `userId`'s data. A different account signing in first wipes what
 * the previous one left (AA-E7, SEC-52), so it can't show or sync into the wrong account. The
 * same account coming back keeps its unsynced changes (AA-E6).
 */
export async function claimDevice(userId: number) {
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(USER_KEY);
  } catch {
    // Storage blocked: nothing can have been kept either
  }
  if (previous !== null && previous !== String(userId)) await wipeDevice();
  try {
    localStorage.setItem(USER_KEY, String(userId));
  } catch {
    // As above
  }
}

const DEVICE_KEY = "agendal.device_id";
let memoryId: string | undefined;

/**
 * This device's id, sent with every call (`X-Device-Id`). Two edits to one field in the same
 * millisecond: the greater device id wins (ADR-004). Sign-out wipes it, so the device gets a new one.
 */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked: one id for this page's life
    return (memoryId ??= crypto.randomUUID());
  }
}
