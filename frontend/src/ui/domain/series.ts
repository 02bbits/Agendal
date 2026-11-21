import type { Task } from "./types";

/**
 * What reopening `id` does to the rest of its repeating series, as the server does it (#168): a
 * series keeps one open occurrence, so every open one after it is withdrawn (an occurrence the
 * user undid never comes back as done) and an open one before it goes back to done.
 * `withdrawnRows` are rows withdrawn before, so the chain still links through them.
 */
export function reopenSeriesChanges(
  rows: readonly Task[],
  withdrawnRows: readonly Task[],
  id: string,
): { withdraw: Task[]; close: Task[] } {
  const known = [...rows, ...withdrawnRows];
  const byId = new Map(known.map((row) => [row.id, row]));
  const following = (taskId: string) =>
    known.find((row) => row.previous_occurrence_id === taskId);

  let first = byId.get(id);
  while (
    first?.previous_occurrence_id &&
    byId.has(first.previous_occurrence_id)
  )
    first = byId.get(first.previous_occurrence_id);

  const withdraw: Task[] = [];
  const close: Task[] = [];
  let after = false;
  for (let node = first; node; node = following(node.id)) {
    const shown = rows.some((row) => row.id === node!.id);
    if (node.id === id) after = true;
    else if (!node.done && shown) (after ? withdraw : close).push(node);
  }
  return { withdraw, close };
}
