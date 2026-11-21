import { Button } from "../../../components/Button";
import { Chip } from "../../../components/Chip";
import { EmptyState } from "../../../components/EmptyState";
import { XIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { ProjectDot } from "../../../components/ProjectDot";
import { TextButton } from "../../../components/TextButton";
import { t, tc, type CopyKey } from "../../../copy";
import type { NoteHit, SearchTab } from "../../../domain/search";
import type { Project, Task, TimeFormat } from "../../../domain/types";
import { NoteHitRow, ProjectHit, TaskHit } from "./SearchHits";
import { SearchHeading, SearchOption } from "./SearchSection";

const TABS: ReadonlyArray<{ tab: SearchTab; label: CopyKey }> = [
  { tab: "all", label: "list.filter_all" },
  { tab: "tasks", label: "search.tab_tasks" },
  { tab: "projects", label: "search.tab_projects" },
  { tab: "notes", label: "search.tab_notes" },
];
/** Widths of the three loading rows, so they don't look like one block. */
const SKELETON_WIDTHS = ["50%", "70%", "40%"];

/** "Nothing matches this filter." without Upcoming's "Show all": the filter chip's × clears it here. */
const filterEmptyPrefix = () =>
  t("list.filter_empty").split(t("common.show_all"))[0]!.trim();

const shows = (tab: SearchTab, section: SearchTab) =>
  tab === "all" || tab === section;

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2" role="status" aria-busy="true">
      {SKELETON_WIDTHS.map((width) => (
        <div
          key={width}
          className="flex h-12 items-center gap-3 rounded-tile border border-separator/40 bg-surface px-4 py-3"
        >
          <div className="size-5 shrink-0 rounded-full bg-fill/80 animate-pulse" />
          <div
            className="h-4 rounded-xl bg-fill/80 animate-pulse"
            style={{ width }}
          />
          <div className="ml-auto h-4 w-16 shrink-0 rounded-full bg-fill/60 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * Search once something is typed or picked: the filter in use, the All / Tasks / Projects / Notes
 * tabs with their counts, then the results as one listbox the keyboard moves through.
 */
export function SearchResults({
  variant,
  query,
  tab,
  onTab,
  filterLabel,
  onClearFilter,
  projects,
  projectId,
  onProject,
  pending,
  error,
  onRetry,
  tasks,
  taskCount,
  hasMoreTasks,
  onLoadMore,
  notes,
  showNotes,
  projectHits,
  listboxId,
  activeIndex,
  onOpenTask,
  onOpenNote,
  onOpenProject,
  today,
  timeFormat,
}: {
  variant: "popup" | "screen";
  query: string;
  tab: SearchTab;
  onTab: (tab: SearchTab) => void;
  /** The quick filter, Completed or project in use, which a tap clears. */
  filterLabel: string | null;
  onClearFilter: () => void;
  projects: Project[];
  projectId: string | null;
  onProject: (id: string | null) => void;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
  tasks: Task[];
  taskCount: number;
  hasMoreTasks: boolean;
  onLoadMore: () => void;
  notes: NoteHit[];
  /** Notes only answer a text search, not a quick filter or a project. */
  showNotes: boolean;
  projectHits: Project[];
  listboxId: string;
  activeIndex: number;
  onOpenTask: (id: string) => void;
  onOpenNote: (id: string) => void;
  onOpenProject: (id: string) => void;
  today: string;
  timeFormat: TimeFormat;
}) {
  const countOf: Record<SearchTab, number> = {
    all: taskCount + projectHits.length + notes.length,
    tasks: taskCount,
    projects: projectHits.length,
    notes: notes.length,
  };
  const taskRows = shows(tab, "tasks") ? tasks : [];
  const noteRows = shows(tab, "notes") && showNotes ? notes : [];
  const projectRows = shows(tab, "projects") ? projectHits : [];
  const noResults =
    (shows(tab, "tasks") ? tasks.length : 0) +
      (shows(tab, "notes") ? notes.length : 0) +
      projectRows.length ===
    0;
  // Each result's place in the listbox, across the three groups
  const noteStart = taskRows.length;
  const projectStart = noteStart + noteRows.length;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        className="flex flex-wrap items-center gap-1.5 px-1 py-1"
      >
        {filterLabel && (
          <Chip selected icon={<XIcon size={14} />} onClick={onClearFilter}>
            {filterLabel}
          </Chip>
        )}
        {TABS.map(({ tab: each, label }) => (
          <Chip
            key={each}
            role="tab"
            aria-selected={tab === each}
            selected={tab === each}
            onClick={() => onTab(each)}
          >
            {t(label)}
            {!pending && countOf[each] > 0 && ` ${countOf[each]}`}
          </Chip>
        ))}
        {variant === "popup" && (
          <div className="ml-auto shrink-0">
            <Picker
              label={t("search.any_project")}
              value={projectId ?? ""}
              onChange={(value) => onProject(value || null)}
              options={[
                { value: "", label: t("search.any_project") },
                ...projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                  leading: <ProjectDot colour={project.colour} />,
                })),
              ]}
            />
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {pending ? "" : tc("search.count", countOf[tab])}
      </p>

      {pending ? (
        <ResultsSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-body text-ink-secondary">{t("error.generic")}</p>
          <Button variant="secondary" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        </div>
      ) : noResults && query.trim() ? (
        <EmptyState title={t("search.no_match", { query: query.trim() })} />
      ) : noResults ? (
        // Only a filter or a project picked, nothing typed: no text to name, so the filter's own message
        <EmptyState title={filterEmptyPrefix()} />
      ) : (
        <div id={listboxId} role="listbox" className="flex flex-col gap-3">
          {taskRows.length > 0 && (
            <div className="flex flex-col">
              <SearchHeading>{t("search.tab_tasks")}</SearchHeading>
              <div className="flex flex-col gap-2">
                {taskRows.map((task, i) => (
                  <SearchOption
                    key={task.id}
                    index={i}
                    active={activeIndex === i}
                    onSelect={() => onOpenTask(task.id)}
                  >
                    <TaskHit
                      task={task}
                      project={projects.find((p) => p.id === task.project_id)}
                      query={query}
                      today={today}
                      timeFormat={timeFormat}
                    />
                  </SearchOption>
                ))}
              </div>
              {hasMoreTasks && (
                <TextButton className="mt-2 w-full" onClick={onLoadMore}>
                  {t("search.load_more")}
                </TextButton>
              )}
            </div>
          )}

          {shows(tab, "notes") && showNotes && (
            <div className="flex flex-col">
              <SearchHeading>{t("search.tab_notes")}</SearchHeading>
              {notes.length === 0 && (
                <p className="m-0 px-3 py-2 text-footnote text-ink-tertiary">
                  {t("search.no_notes")}
                </p>
              )}
              <div className="flex flex-col gap-2">
                {noteRows.map((note, i) => (
                  <SearchOption
                    key={note.id}
                    index={noteStart + i}
                    active={activeIndex === noteStart + i}
                    onSelect={() => onOpenNote(note.id)}
                    alignTop
                  >
                    <NoteHitRow note={note} query={query} today={today} />
                  </SearchOption>
                ))}
              </div>
            </div>
          )}

          {projectRows.length > 0 && (
            <div className="flex flex-col">
              <SearchHeading>{t("search.tab_projects")}</SearchHeading>
              <div className="flex flex-col gap-2">
                {projectRows.map((project, i) => (
                  <SearchOption
                    key={project.id}
                    index={projectStart + i}
                    active={activeIndex === projectStart + i}
                    onSelect={() => onOpenProject(project.id)}
                  >
                    <ProjectHit project={project} query={query} />
                  </SearchOption>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
