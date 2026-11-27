import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { t } from "../../copy";
import {
  addRecent,
  clearRecent,
  readRecent,
  removeRecent,
} from "../../domain/recentSearches";
import type { NoteHit, SearchFilter, SearchTab } from "../../domain/search";
import type { Project, Task, TimeFormat } from "../../domain/types";
import { SearchField } from "./search/SearchField";
import {
  FILTER_LABEL,
  SearchHome,
  type QuickFilter,
} from "./search/SearchHome";
import { SearchResults } from "./search/SearchResults";
import { useSearchKeyboard } from "./search/useSearchKeyboard";
import { useSearch } from "./useSearch";

export interface SearchPanelProps {
  variant: "popup" | "screen";
  projects: Project[];
  today: string;
  timeFormat: TimeFormat;
  searchTasks(params: {
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
  searchNotes(q: string): Promise<{ items: NoteHit[] }>;
  onOpenTask(id: string): void;
  onOpenProject(id: string): void;
  onOpenNote(id: string): void;
  onCancel?(): void;
  inputRef?: React.Ref<HTMLInputElement>;
}

/** One result the keyboard can reach, in the order the listbox shows them. */
type ResultRow =
  | { type: "task"; id: string }
  | { type: "note"; id: string }
  | { type: "project"; id: string };

/** What the one constraint in use is called: its quick filter, Completed or its project. */
function constraintLabel({
  filter,
  completed,
  projectId,
  projects,
}: {
  filter: SearchFilter | null;
  completed: boolean;
  projectId: string | null;
  projects: Project[];
}): string | null {
  if (filter) return t(FILTER_LABEL[filter]);
  if (completed) return t(FILTER_LABEL.completed);
  if (!projectId) return null;
  const project = projects.find((p) => p.id === projectId);
  return project?.name ?? t("search.in_project");
}

/**
 * Search (LV-5, NU): the field, then either the home (quick filters, recent searches, projects)
 * or the results. Used by the desktop popup and the phone's Search screen.
 */
export const SearchPanel = forwardRef<HTMLInputElement, SearchPanelProps>(
  function SearchPanel(
    {
      variant,
      projects,
      today,
      timeFormat,
      searchTasks,
      searchNotes,
      onOpenTask,
      onOpenProject,
      onOpenNote,
      onCancel,
      inputRef,
    },
    ref,
  ): ReactElement {
    const fieldRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => fieldRef.current as HTMLInputElement);
    useImperativeHandle(inputRef, () => fieldRef.current as HTMLInputElement);
    const listboxId = useId();

    const search = useSearch({ searchTasks, searchNotes, projects });
    const {
      input,
      setInput,
      filter,
      setFilter,
      completed,
      setCompleted,
      projectId,
      setProjectId,
    } = search;

    const [tab, setTab] = useState<SearchTab>("all");
    const [recent, setRecent] = useState<string[]>([]);
    useEffect(() => setRecent(readRecent()), []);
    useEffect(() => fieldRef.current?.focus(), []);

    // A new search starts on All
    const searchKey = JSON.stringify([
      input.trim(),
      filter,
      completed,
      projectId,
    ]);
    const lastSearchKey = useRef(searchKey);
    useEffect(() => {
      if (lastSearchKey.current === searchKey) return;
      lastSearchKey.current = searchKey;
      setTab("all");
    }, [searchKey]);

    /** Only one constraint at a time: a quick filter, Completed or a project. */
    const constrain = (next: {
      filter?: SearchFilter | null;
      completed?: boolean;
      projectId?: string | null;
    }) => {
      setFilter(next.filter ?? null);
      setCompleted(next.completed ?? false);
      setProjectId(next.projectId ?? null);
    };
    const chooseQuickFilter = (quick: QuickFilter) =>
      constrain(
        quick === "completed" ? { completed: true } : { filter: quick },
      );

    const remember = () => {
      if (!input.trim()) return;
      addRecent(input);
      setRecent(readRecent());
    };

    const rows = useMemo<ResultRow[]>(
      () => [
        ...(tab === "all" || tab === "tasks"
          ? search.tasks.map((task) => ({ type: "task" as const, id: task.id }))
          : []),
        ...(tab === "all" || tab === "notes"
          ? search.notes.map((note) => ({ type: "note" as const, id: note.id }))
          : []),
        ...(tab === "all" || tab === "projects"
          ? search.projectHits.map((p) => ({
              type: "project" as const,
              id: p.id,
            }))
          : []),
      ],
      [tab, search.tasks, search.notes, search.projectHits],
    );

    const openTask = (id: string) => {
      if (input.trim()) addRecent(input);
      onOpenTask(id);
    };
    const openProject = (id: string) => {
      if (input.trim()) addRecent(input);
      onOpenProject(id);
    };
    const openRow = (row: ResultRow) => {
      if (row.type === "task") openTask(row.id);
      else if (row.type === "project") openProject(row.id);
      else onOpenNote(row.id);
    };

    const keyboard = useSearchKeyboard({
      rows,
      inputRef: fieldRef,
      canOpen: !search.pending,
      open: openRow,
      searchNow: () => {
        remember();
        search.runNow();
      },
    });

    const filterLabel = constraintLabel({
      filter,
      completed,
      projectId,
      projects,
    });

    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <SearchField
          variant={variant}
          inputRef={fieldRef}
          value={input}
          onChange={setInput}
          onKeyDown={keyboard.onKeyDown}
          expanded={search.hasCriteria}
          listboxId={listboxId}
          activeOptionId={keyboard.activeOptionId}
          onCancel={onCancel}
        />

        <div
          className={
            variant === "screen"
              ? "flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom))]"
              : "flex-1 overflow-y-auto overscroll-contain p-2"
          }
        >
          {search.hasCriteria ? (
            <SearchResults
              variant={variant}
              query={input}
              tab={tab}
              onTab={setTab}
              filterLabel={filterLabel}
              onClearFilter={() => constrain({})}
              projects={projects}
              projectId={projectId}
              onProject={setProjectId}
              pending={search.pending}
              error={Boolean(search.error)}
              limited={search.limited}
              onRetry={search.retry}
              tasks={search.tasks}
              taskCount={search.counts.all}
              hasMoreTasks={Boolean(search.nextCursor)}
              onLoadMore={() => void search.loadMore()}
              notes={search.notes}
              showNotes={
                input.trim() !== "" && !filter && !completed && !projectId
              }
              projectHits={search.projectHits}
              listboxId={listboxId}
              activeIndex={keyboard.activeIndex}
              onOpenTask={openTask}
              onOpenNote={onOpenNote}
              onOpenProject={openProject}
              today={today}
              timeFormat={timeFormat}
            />
          ) : (
            <SearchHome
              projects={projects}
              recent={recent}
              onFilter={chooseQuickFilter}
              onProject={(id) => constrain({ projectId: id })}
              onRecent={(query) => {
                setInput(query);
                constrain({});
                addRecent(query);
                setRecent(readRecent());
                search.runNow();
              }}
              onRemoveRecent={(query) => setRecent(removeRecent(query))}
              onClearRecent={() => {
                clearRecent();
                setRecent([]);
              }}
            />
          )}
        </div>
      </div>
    );
  },
);
