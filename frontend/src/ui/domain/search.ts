import type { Task } from "./types";

export const QUERY_MAX = 100;
export type SearchStatus = "all" | "open" | "completed";

/**
 * Case- and accent-insensitive form (LV-3): "Bài tập" → "bai tap", "café" → "cafe".
 * Mirrors PostgreSQL `lower(unaccent(…))`, including đ → d.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function queryWords(query: string): string[] {
  return normalize(query.slice(0, QUERY_MAX)).split(/\s+/).filter(Boolean);
}

export interface SearchResult {
  items: Task[];
  counts: Record<SearchStatus, number>;
}

/**
 * Searches titles and notes, completed included (LV-3). Every word must match,
 * in any order and any field; the query is literal text (LV-E6). Ranked: title
 * matches first (a task matching both is a title match, LV-E7), then open
 * before completed, then soonest due with no date last.
 */
export function searchTasks(
  tasks: readonly Task[],
  query: string,
  status: SearchStatus,
): SearchResult {
  const words = queryWords(query);
  const counts = { all: 0, open: 0, completed: 0 };
  if (!words.length) return { items: [], counts };

  const scored: Array<{ task: Task; inTitle: boolean }> = [];
  for (const task of tasks) {
    const title = normalize(task.title);
    const haystack = `${title} ${normalize(task.notes ?? "")}`;
    if (!words.every((w) => haystack.includes(w))) continue;
    counts.all += 1;
    counts[task.done ? "completed" : "open"] += 1;
    if (status === "open" && task.done) continue;
    if (status === "completed" && !task.done) continue;
    scored.push({ task, inTitle: words.every((w) => title.includes(w)) });
  }

  scored.sort(
    (a, b) =>
      Number(b.inTitle) - Number(a.inTitle) ||
      Number(a.task.done) - Number(b.task.done) ||
      (a.task.due_date ?? "9999").localeCompare(b.task.due_date ?? "9999"),
  );
  return { items: scored.map((s) => s.task), counts };
}

/**
 * Splits a title into matched and plain parts, for bold highlights built as
 * text nodes, never as injected HTML (SC-08). Matching is accent-insensitive.
 */
export function highlightParts(
  title: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const words = queryWords(query);
  if (!words.length) return [{ text: title, match: false }];
  // Map each normalized character back to its source index (NFD can split one character into several)
  const chars = [...title];
  let normalized = "";
  const source: number[] = [];
  chars.forEach((ch, i) => {
    const n = normalize(ch);
    normalized += n;
    for (let k = 0; k < n.length; k++) source.push(i);
  });
  const marked = new Array<boolean>(chars.length).fill(false);
  for (const word of words) {
    let at = normalized.indexOf(word);
    while (at >= 0) {
      for (let k = at; k < at + word.length; k++) marked[source[k]!] = true;
      at = normalized.indexOf(word, at + word.length);
    }
  }
  const parts: Array<{ text: string; match: boolean }> = [];
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += ch;
    else parts.push({ text: ch, match: marked[i]! });
  });
  return parts;
}
