import { useSyncExternalStore } from "react";
import { readSetting, saveSetting } from "./localStore";

// Tasks whose edit on this device lost to a later one elsewhere (AP §2.2, UX-41): the row shows
// "Changed on another device" until the task is opened. Kept on the device, so a reload keeps it.
const KEY = "conflicts";
/** Fired on `window` with `{detail: {title}}`: the frame shows `app.conflict`. */
export const CONFLICT = "agendal:conflict";

let ids = new Set<string>();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach((listener) => listener());
  void saveSetting(KEY, [...ids]);
}

function load() {
  loaded ??= readSetting<string[]>(KEY).then((saved) => {
    ids = new Set([...(saved ?? []), ...ids]);
    listeners.forEach((listener) => listener());
  });
  return loaded;
}

export async function markConflict(id: string, title: string) {
  await load();
  ids = new Set(ids).add(id);
  changed();
  window.dispatchEvent(new CustomEvent(CONFLICT, { detail: { title } }));
}

/** Opening the task clears its marker. */
export async function clearConflict(id: string) {
  await load();
  if (!ids.has(id)) return;
  ids = new Set(ids);
  ids.delete(id);
  changed();
}

/** Sign-out: nothing of the account stays in memory (SC-19). */
export function forgetConflicts() {
  ids = new Set();
  loaded = null;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
};

export const useConflicted = (id: string) =>
  useSyncExternalStore(
    subscribe,
    () => ids.has(id),
    () => false,
  );
