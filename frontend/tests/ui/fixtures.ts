import type { Project, Task } from "../../src/ui/domain/types";

// The demo account from the design: Friday 23 October 2026.
export const TODAY = "2026-10-23";

export const projects: Project[] = [
  {
    id: "p-sql",
    name: "SQL Course",
    colour: "blue",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "p-web",
    name: "Adv Web",
    colour: "red",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "p-hci",
    name: "HCI",
    colour: "orange",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "p-port",
    name: "Portfolio",
    colour: "green",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "p-pers",
    name: "Personal",
    colour: "purple",
    created_at: "2026-09-01T08:00:00Z",
  },
];

let seq = 0;
export function task(overrides: Partial<Task> & Pick<Task, "title">): Task {
  seq += 1;
  return {
    id: `t-${seq}`,
    due_date: null,
    start_time: null,
    end_time: null,
    priority: "low",
    project_id: null,
    repeat: "never",
    reminder: "none",
    notes: null,
    done: false,
    done_at: null,
    created_by: "user",
    created_at: `2026-10-20T08:${String(seq).padStart(2, "0")}:00Z`,
    ...overrides,
  };
}

export const projectById = (id: string | null) =>
  projects.find((p) => p.id === id) ?? null;
