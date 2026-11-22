import { useCallback, useSyncExternalStore } from "react";
import type { SortMode } from "../../domain/order";

/** The lists that can be sorted by hand (#178). */
export type SortList = "today" | "no_date" | "upcoming" | `project:${string}`;

const KEY = "agendal.sort_modes";
const CHANGED = "agendal:sort-modes";

/** Today and Upcoming follow Agendal's rules by default; a project and No date keep the user's order. */
export function defaultSortMode(list: SortList): SortMode {
  return list === "today" || list === "upcoming" ? "smart" : "manual";
}

function readAll(): Record<string, SortMode> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, SortMode>)
      : {};
  } catch {
    return {};
  }
}

export function readSortMode(list: SortList): SortMode {
  const saved = readAll()[list];
  return saved === "smart" || saved === "manual"
    ? saved
    : defaultSortMode(list);
}

export function writeSortMode(list: SortList, mode: SortMode): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [list]: mode }));
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A list's sort mode, remembered on this device like the Upcoming filter (LV §2.2). */
export function useSortMode(
  list: SortList,
): [SortMode, (mode: SortMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    () => readSortMode(list),
    () => defaultSortMode(list),
  );
  const setMode = useCallback(
    (next: SortMode) => writeSortMode(list, next),
    [list],
  );
  return [mode, setMode];
}
