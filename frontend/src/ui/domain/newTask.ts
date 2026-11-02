import { addDays, startOfWeek } from "./dates";
import type { Priority } from "./types";

export type DueChip = "today" | "tomorrow" | "next_week" | "none" | "pick";

export interface NewTaskDefaults {
  chip: DueChip;
  projectId?: string;
}

export interface CreateTaskInput {
  id: string;
  title: string;
  dueDate?: string | null;
  priority?: Priority;
  projectId?: string | null;
}

export interface CreateTaskBody {
  id: string;
  title: string;
  due_date?: string;
  priority?: Priority;
  project_id?: string;
}

/**
 * Computes the due date string for a selected due chip.
 * NC §2.5, NU-E10.
 */
export function dueDateFor(
  chip: DueChip,
  today: string,
  picked?: string,
): string | null {
  switch (chip) {
    case "today":
      return today;
    case "tomorrow":
      return addDays(today, 1);
    case "next_week":
      return startOfWeek(addDays(today, 7), "mon");
    case "none":
      return null;
    case "pick":
      return picked ?? null;
  }
}

/**
 * Returns default due chip and project based on where the sheet was opened.
 * NC §2.5 table.
 */
export function defaultsFor(pathname: string): NewTaskDefaults {
  if (pathname === "/") {
    return { chip: "today" };
  }
  if (pathname === "/upcoming") {
    return { chip: "tomorrow" };
  }
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (match && match[1]) {
    if (match[1] === "none") {
      return { chip: "none" };
    }
    return { chip: "none", projectId: match[1] };
  }
  return { chip: "none" };
}

/**
 * Default priority follows the NU rule: "medium" when due today, else "low".
 */
export function defaultPriority(
  dueDate: string | null,
  today: string,
): "medium" | "low" {
  return dueDate === today ? "medium" : "low";
}

/**
 * Builds the `POST /tasks` payload: trimmed title, omitting nulls/undefined.
 */
export function createBody({
  id,
  title,
  dueDate,
  priority,
  projectId,
}: CreateTaskInput): CreateTaskBody {
  const body: CreateTaskBody = {
    id,
    title: title.trim(),
  };
  if (dueDate) {
    body.due_date = dueDate;
  }
  if (priority) {
    body.priority = priority;
  }
  if (projectId) {
    body.project_id = projectId;
  }
  return body;
}
