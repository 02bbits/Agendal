import { normalize } from "./search";

const STORAGE_KEY = "agendal.search.recent";
const MAX_RECENT = 5;

export function readRecent(): string[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function addRecent(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return readRecent();
  try {
    const current = readRecent();
    const normTarget = normalize(trimmed);
    const filtered = current.filter((item) => normalize(item) !== normTarget);
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return [];
  }
}

export function removeRecent(query: string): string[] {
  try {
    const current = readRecent();
    const normTarget = normalize(query.trim());
    const updated = current.filter((item) => normalize(item) !== normTarget);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return [];
  }
}

export function clearRecent(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
