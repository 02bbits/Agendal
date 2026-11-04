import type { Task } from "./types";

export const QUERY_MAX = 100;
export type SearchStatus = "all" | "open" | "completed";

export type SearchFilter =
  "overdue" | "due_week" | "starts_today" | "high_priority" | "from_note";

export type SearchTab = "all" | "tasks" | "projects" | "notes";

export interface NoteHit {
  id: string;
  title: string;
  snippet: string;
  status: string;
  written_at: string;
}

const TONE_PAIRS: Record<string, string> = {
  òa: "oà",
  oà: "òa",
  óa: "oá",
  oá: "óa",
  ỏa: "oả",
  oả: "ỏa",
  õa: "oã",
  oã: "õa",
  ọa: "oạ",
  oạ: "ọa",
  òe: "oè",
  oè: "òe",
  óe: "oé",
  oé: "óe",
  ỏe: "oẻ",
  oẻ: "ỏe",
  õe: "oẽ",
  oẽ: "õe",
  ọe: "oẹ",
  oẹ: "ọe",
  ùy: "uỳ",
  uỳ: "ùy",
  úy: "uý",
  uý: "úy",
  ủy: "uỷ",
  uỷ: "ủy",
  ũy: "uỹ",
  uỹ: "ũy",
  ụy: "uỵ",
  uỵ: "ụy",
};

function toneForms(word: string): string[] {
  for (const [k, v] of Object.entries(TONE_PAIRS)) {
    if (word.includes(k)) {
      const swapped = word.replaceAll(k, v);
      if (swapped !== word) {
        return [word, swapped];
      }
    }
  }
  return [word];
}

function isAccented(word: string): boolean {
  return (
    word !== normalize(word) &&
    /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{S}]+$/u.test(word)
  );
}

function isShort(word: string): boolean {
  return [...normalize(word)].length <= 2 && /^[\p{L}\p{M}\p{N}]+$/u.test(word);
}

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
  const parts = query
    .slice(0, QUERY_MAX)
    .normalize("NFC")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return Array.from(new Set(parts));
}

export function matchRanges(
  text: string,
  word: string,
): Array<[number, number]> {
  const w = word.normalize("NFC").toLowerCase();
  if (!w) return [];

  const chars = [...text.normalize("NFC")];
  if (chars.length === 0) return [];

  let lowerText = "";
  const lowerSource: number[] = [];
  let foldText = "";
  const foldSource: number[] = [];

  chars.forEach((ch, i) => {
    const l = ch.toLowerCase();
    lowerText += l;
    for (let k = 0; k < l.length; k++) {
      lowerSource.push(i);
    }

    const f = normalize(ch);
    foldText += f;
    for (let k = 0; k < f.length; k++) {
      foldSource.push(i);
    }
  });

  const isWordChar = (ch: string | undefined): boolean =>
    ch !== undefined && /[\p{L}\p{M}\p{N}]/u.test(ch);

  const ranges: Array<[number, number]> = [];

  const findMatches = (
    target: string,
    sourceMap: number[],
    searchStr: string,
    mode: "start" | "whole" | "anywhere",
  ) => {
    if (!searchStr) return;
    let at = target.indexOf(searchStr);
    while (at !== -1) {
      const srcStart = sourceMap[at];
      const srcEnd = sourceMap[at + searchStr.length - 1];
      if (srcStart !== undefined && srcEnd !== undefined) {
        const actualEnd = srcEnd + 1;
        let valid = true;
        if (mode === "start") {
          valid = srcStart === 0 || !isWordChar(chars[srcStart - 1]);
        } else if (mode === "whole") {
          const isStart = srcStart === 0 || !isWordChar(chars[srcStart - 1]);
          const isEnd =
            actualEnd === chars.length || !isWordChar(chars[actualEnd]);
          valid = isStart && isEnd;
        }

        if (valid) {
          ranges.push([srcStart, actualEnd]);
        }
      }
      at = target.indexOf(searchStr, at + 1);
    }
  };

  const short = isShort(w);

  if (!isAccented(w)) {
    findMatches(
      foldText,
      foldSource,
      normalize(w),
      short ? "start" : "anywhere",
    );
  } else {
    for (const form of toneForms(w)) {
      findMatches(lowerText, lowerSource, form, short ? "start" : "anywhere");
    }

    const folded = normalize(w);
    if ([...folded].length >= 2) {
      findMatches(lowerText, lowerSource, folded, short ? "whole" : "anywhere");
    }
  }

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const uniqueRanges: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = uniqueRanges[uniqueRanges.length - 1];
    if (!last || last[0] !== r[0] || last[1] !== r[1]) {
      uniqueRanges.push(r);
    }
  }
  return uniqueRanges;
}

export function wordMatches(text: string, word: string): boolean {
  return matchRanges(text, word).length > 0;
}

/** Projects whose name has every word; order kept. */
export function searchProjects<P extends { name: string }>(
  projects: readonly P[],
  query: string,
): P[] {
  const words = queryWords(query);
  if (!words.length) return [];
  return projects.filter((project) =>
    words.every((w) => wordMatches(project.name, w)),
  );
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
    const haystack = `${task.title} ${task.notes ?? ""}`;
    if (!words.every((w) => wordMatches(haystack, w))) continue;
    counts.all += 1;
    counts[task.done ? "completed" : "open"] += 1;
    if (status === "open" && task.done) continue;
    if (status === "completed" && !task.done) continue;
    scored.push({
      task,
      inTitle: words.every((w) => wordMatches(task.title, w)),
    });
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
  const chars = [...title.normalize("NFC")];
  if (!words.length) {
    return [{ text: chars.join(""), match: false }];
  }

  const marked = new Array<boolean>(chars.length).fill(false);
  for (const word of words) {
    const ranges = matchRanges(title, word);
    for (const [start, end] of ranges) {
      for (let k = start; k < end; k++) {
        marked[k] = true;
      }
    }
  }

  const parts: Array<{ text: string; match: boolean }> = [];
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) {
      last.text += ch;
    } else {
      parts.push({ text: ch, match: marked[i] ?? false });
    }
  });
  return parts;
}
