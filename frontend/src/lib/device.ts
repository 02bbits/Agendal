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
