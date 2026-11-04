import type { NoteHit, SearchFilter } from "../../domain/search";
import type { Project, Task, TimeFormat } from "../../domain/types";
import { ROUTES, type Navigate } from "../shell/routes";
import { SearchPanel } from "./SearchPanel";

export interface SearchScreenProps {
  onBack(): void;
  navigate?: Navigate;
  projects?: Project[];
  today?: string;
  timeFormat?: TimeFormat;
  searchTasks?(params: {
    q?: string;
    status?: "all" | "open" | "completed";
    cursor?: string;
    filter?: SearchFilter;
    project_id?: string;
  }): Promise<{
    items: Task[];
    counts: { all: number; open: number; completed: number };
    next_cursor: string | null;
  }>;
  searchNotes?(q: string): Promise<{ items: NoteHit[] }>;
}

export function SearchScreen({
  onBack,
  navigate,
  projects = [],
  today = "",
  timeFormat = "24h",
  searchTasks = async () => ({
    items: [],
    counts: { all: 0, open: 0, completed: 0 },
    next_cursor: null,
  }),
  searchNotes = async () => ({ items: [] }),
}: SearchScreenProps) {
  return (
    <div className="min-h-dvh pt-[calc(env(safe-area-inset-top,0px)+40px)] pb-2">
      <SearchPanel
        variant="screen"
        projects={projects}
        today={today}
        timeFormat={timeFormat}
        searchTasks={searchTasks}
        searchNotes={searchNotes}
        onCancel={onBack}
        onOpenTask={(id) => {
          navigate?.(ROUTES.task(id));
        }}
        onOpenProject={(id) => {
          navigate?.(ROUTES.project(id));
        }}
        onOpenNote={() => {
          // TODO: open the note here once the Notes screen is done.
        }}
      />
    </div>
  );
}
