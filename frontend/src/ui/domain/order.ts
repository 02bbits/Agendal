import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import type { Task } from "./types";

/** Which manual order a list uses (#178): a day (Today, an Upcoming day) or a project / No date. */
export type OrderField = "day_order" | "project_order";

/** Smart: the list's rules order it. Manual: tasks placed by hand keep their place. */
export type SortMode = "smart" | "manual";

/** Keys are base-62 ASCII, so plain code-unit order; never localeCompare. */
function byKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const keyOf = (task: Task, field: OrderField) => task[field] ?? null;

/**
 * Manual order: tasks placed by hand, by their key (ties by id, so every device agrees), then the
 * tasks never placed in the list's rule order. A new task therefore lands at the bottom.
 */
export function manualOrder(
  tasks: readonly Task[],
  field: OrderField,
  byRules: (tasks: readonly Task[]) => Task[],
): Task[] {
  const placed = tasks
    .filter((t) => keyOf(t, field))
    .sort(
      (a, b) => byKey(keyOf(a, field)!, keyOf(b, field)!) || byKey(a.id, b.id),
    );
  return [...placed, ...byRules(tasks.filter((t) => !keyOf(t, field)))];
}

/** Orders a list by its mode. */
export function orderList(
  tasks: readonly Task[],
  mode: SortMode,
  field: OrderField,
  byRules: (tasks: readonly Task[]) => Task[],
): Task[] {
  return mode === "manual"
    ? manualOrder(tasks, field, byRules)
    : byRules(tasks);
}

/**
 * The keys to write when `movedId` is dropped at index `to` of `shown` (the list as on screen,
 * the moved task still in it). Usually only the moved task gets a key, between its new
 * neighbours. Dropped among tasks never placed, those above the drop point get keys first,
 * once, so the list keeps the order the user sees (Spec 02 §4.1, no re-index of other rows).
 */
export function placeAt(
  shown: readonly Task[],
  movedId: string,
  to: number,
  field: OrderField,
): Map<string, string> {
  const moved = shown.find((t) => t.id === movedId);
  if (!moved) return new Map();
  const rest = shown.filter((t) => t.id !== movedId);
  const index = Math.max(0, Math.min(to, rest.length));
  const above = rest.slice(0, index);
  const below = rest.slice(index);

  const firstUnplaced = above.findIndex((t) => !keyOf(t, field));
  const keys = new Map<string, string>();
  try {
    if (firstUnplaced === -1) {
      const before = above.length
        ? keyOf(above[above.length - 1]!, field)
        : null;
      const after = below.length ? keyOf(below[0]!, field) : null;
      keys.set(movedId, generateKeyBetween(before, after));
      return keys;
    }
    // Place the unplaced run above the drop point, then the moved task, after the last placed one
    const lastPlaced = firstUnplaced
      ? keyOf(above[firstUnplaced - 1]!, field)
      : null;
    const run = [...above.slice(firstUnplaced), moved];
    const runKeys = generateNKeysBetween(lastPlaced, null, run.length);
    run.forEach((t, i) => keys.set(t.id, runKeys[i]!));
    return keys;
  } catch {
    // Two devices made the same key (the neighbours tie): place the whole list again, once
    return rulesKeys([...above, moved, ...below]);
  }
}

/** "Sort by rules" (Spec 02 §2.1): one key per task, in the given (rule) order. */
export function rulesKeys(ordered: readonly Task[]): Map<string, string> {
  const keys = generateNKeysBetween(null, null, ordered.length);
  return new Map(ordered.map((t, i) => [t.id, keys[i]!]));
}
