import { api } from "./api";
import { handleResponse } from "./apiError";
import { pendingNotes } from "./noteApi";

/** `GET /counts` (AP §7): the sidebar's numbers, by the same rules as the lists they stand for. */
export interface SidebarCounts {
  inbox: number;
  upcoming: number;
  /** Open tasks in no project. */
  no_project: number;
  notes: number;
}

/** One call for every sidebar count; notes still waiting for a connection count too (NC-6). */
export async function sidebarCounts(): Promise<SidebarCounts> {
  const [counts, waiting] = await Promise.all([
    handleResponse<SidebarCounts>(await api("/counts")),
    pendingNotes(),
  ]);
  return { ...counts, notes: counts.notes + waiting.length };
}
