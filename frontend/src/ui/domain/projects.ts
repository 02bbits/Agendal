import type { CopyKey } from "../copy";
import type { Progress } from "./progress";
import type { Project, ProjectColor, Task } from "./types";

export const PROJECT_LIMIT = 50;
export const PROJECT_NAME_MAX = 40;
export const PROJECT_COLOR_ORDER: readonly ProjectColor[] = [
  "blue",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "purple",
  "gray",
];

/** Name 1–40 characters after trimming, counted in characters, not bytes (PJ-E8). Create stays disabled otherwise. */
export function projectNameValid(name: string): boolean {
  const length = [...name.trim()].length;
  return length > 0 && length <= PROJECT_NAME_MAX;
}

/** Unique per user, trimmed and ignoring case (PJ-1, PJ-E1). */
export function projectNameError(
  name: string,
  projects: readonly Project[],
  exceptId?: string,
): CopyKey | null {
  const key = name.trim().toLocaleLowerCase();
  return projects.some(
    (p) => p.id !== exceptId && p.name.trim().toLocaleLowerCase() === key,
  )
    ? "project.name_taken"
    : null;
}

/** The first colour not used yet, or the first colour when all are used (PJ §2.1). */
export function defaultProjectColour(
  projects: readonly Project[],
): ProjectColor {
  const used = new Set(projects.map((p) => p.colour));
  return (
    PROJECT_COLOR_ORDER.find((c) => !used.has(c)) ?? PROJECT_COLOR_ORDER[0]!
  );
}

/** Alphabetical, locale-aware and case-insensitive (PJ §2.2). */
export function sortProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/** M counts every task in the project, open and completed; N the completed ones (PJ-2). */
export function projectProgress(
  tasks: readonly Task[],
  projectId: string | null,
): Progress {
  const mine = tasks.filter((t) => t.project_id === projectId);
  return { done: mine.filter((t) => t.done).length, total: mine.length };
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Open tasks: by due date (no date last), then priority, then created (PJ §2.3). */
export function sortOpenByDue(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.created_at.localeCompare(b.created_at),
  );
}

/** Completed tasks: newest completion first. */
export function sortCompleted(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) =>
    (b.done_at ?? "").localeCompare(a.done_at ?? ""),
  );
}
