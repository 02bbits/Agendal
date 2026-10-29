import { t, type CopyKey } from "../../copy";
import { EmptyState } from "../../components/EmptyState";
import type { TabId } from "./routes";

/** Each tab's empty state, so every route renders something before data arrives. */
export const EMPTY_STATE: Record<TabId | "search", CopyKey> = {
  inbox: "list.first_run",
  upcoming: "list.upcoming_empty",
  projects: "project.list_empty",
  notes: "note.list_empty",
  search: "search.hint",
};

export function RouteEmptyState({ route }: { route: TabId | "search" }) {
  return <EmptyState title={t(EMPTY_STATE[route])} />;
}
