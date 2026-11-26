/** Drop targets that aren't lists (#178). */
export const PROJECT_DROP = "project";

/** A project in the sidebar a task can be dropped on. */
export interface ProjectDropData {
  kind: typeof PROJECT_DROP;
  /** null: "No project". */
  projectId: string | null;
  name: string;
  /** For the announcement while a task is over it. */
  title: string;
}
