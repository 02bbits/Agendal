import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { timeZone } from "../../../lib/clock";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { cx } from "../../components/cx";
import { EmptyState } from "../../components/EmptyState";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  NotesIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "../../components/icons";
import { Picker } from "../../components/Picker";
import { ProjectDot } from "../../components/ProjectDot";
import { t, tc } from "../../copy";
import { formatDay, formatTime } from "../../domain/dates";
import { localDateTime } from "../../domain/edit";
import {
  addRecent,
  clearRecent,
  readRecent,
  removeRecent,
} from "../../domain/recentSearches";
import {
  highlightParts,
  QUERY_MAX,
  type NoteHit,
  type SearchFilter,
  type SearchTab,
} from "../../domain/search";
import type { Project, Task, TimeFormat } from "../../domain/types";
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

function renderHighlighted(text: string, query: string) {
  // Matched words with only a space between them read as one highlight
  const parts = highlightParts(text, query).reduce<
    ReturnType<typeof highlightParts>
  >((merged, part, i, all) => {
    const last = merged[merged.length - 1];
    const bridges =
      !part.match && part.text.trim() === "" && all[i + 1]?.match === true;
    if (last?.match && (part.match || bridges)) last.text += part.text;
    else merged.push({ ...part });
    return merged;
  }, []);
  return parts.map((part, i) => {
    return part.match ? (
      <mark
        key={i}
        className="rounded-[3px] bg-ink/20 px-0.5 font-semibold text-ink"
      >
        {part.text}
      </mark>
    ) : (
      part.text
    );
  });
}

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
    const internalInputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(
      ref,
      () => internalInputRef.current as HTMLInputElement,
    );
    useImperativeHandle(
      inputRef,
      () => internalInputRef.current as HTMLInputElement,
    );

    const listboxId = useId();

    const {
      input,
      setInput,
      filter,
      setFilter,
      completed,
      setCompleted,
      projectId,
      setProjectId,
      pending,
      hasCriteria,
      tasks,
      counts,
      nextCursor,
      notes,
      projectHits,
      error,
      retry,
      runNow,
      loadMore,
    } = useSearch({ searchTasks, searchNotes, projects });

    const [tab, setTab] = useState<SearchTab>("all");
    const [recentList, setRecentList] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
      setRecentList(readRecent());
    }, []);

    const key = JSON.stringify([input.trim(), filter, completed, projectId]);
    const prevKeyRef = useRef(key);
    useEffect(() => {
      if (prevKeyRef.current !== key) {
        prevKeyRef.current = key;
        setTab("all");
      }
    }, [key]);

    // Flat visible rows for listbox keyboard navigation
    type VisibleRow =
      | { type: "task"; id: string; item: Task }
      | { type: "project"; id: string; item: Project }
      | { type: "note"; id: string; item: NoteHit };

    const visibleRows: VisibleRow[] = [];
    if (tab === "all" || tab === "tasks") {
      for (const t of tasks) {
        visibleRows.push({ type: "task", id: t.id, item: t });
      }
    }
    if (tab === "all" || tab === "notes") {
      for (const n of notes) {
        visibleRows.push({ type: "note", id: n.id, item: n });
      }
    }
    if (tab === "all" || tab === "projects") {
      for (const p of projectHits) {
        visibleRows.push({ type: "project", id: p.id, item: p });
      }
    }

    // Reset active index to first row whenever new results arrive
    useEffect(() => {
      setActiveIndex(0);
    }, [tasks, projectHits, notes, tab]);

    const activeOptionId =
      visibleRows.length > 0 && activeIndex < visibleRows.length
        ? `search-opt-${activeIndex}`
        : undefined;

    const handleSelectTask = (id: string) => {
      if (input.trim()) {
        addRecent(input);
      }
      onOpenTask(id);
    };

    const handleSelectProject = (id: string) => {
      if (input.trim()) {
        addRecent(input);
      }
      onOpenProject(id);
    };

    const handleSelectNote = (id: string) => {
      onOpenNote(id);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (visibleRows.length > 0) {
          e.preventDefault();
          const next = (activeIndex + 1) % visibleRows.length;
          setActiveIndex(next);
          document
            .getElementById(`search-opt-${next}`)
            ?.scrollIntoView?.({ block: "nearest" });
        }
      } else if (e.key === "ArrowUp") {
        if (visibleRows.length > 0) {
          e.preventDefault();
          const next =
            (activeIndex - 1 + visibleRows.length) % visibleRows.length;
          setActiveIndex(next);
          document
            .getElementById(`search-opt-${next}`)
            ?.scrollIntoView?.({ block: "nearest" });
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pending || visibleRows.length === 0) {
          if (input.trim()) {
            addRecent(input);
            setRecentList(readRecent());
          }
          runNow();
        } else {
          const row = visibleRows[activeIndex];
          if (row) {
            if (row.type === "task") handleSelectTask(row.id);
            else if (row.type === "project") handleSelectProject(row.id);
            else if (row.type === "note") handleSelectNote(row.id);
          }
        }
      }
    };

    const handleRecentClick = (q: string) => {
      setInput(q);
      setFilter(null);
      setCompleted(false);
      setProjectId(null);
      addRecent(q);
      setRecentList(readRecent());
      runNow();
    };

    const handleRemoveRecent = (e: React.MouseEvent, q: string) => {
      e.stopPropagation();
      const updated = removeRecent(q);
      setRecentList(updated);
    };

    const handleClearRecent = () => {
      clearRecent();
      setRecentList([]);
    };

    const clearActiveConstraint = () => {
      setFilter(null);
      setCompleted(false);
      setProjectId(null);
    };

    const activeFilterLabel = filter
      ? filter === "overdue"
        ? t("search.filter_overdue")
        : filter === "due_week"
          ? t("search.filter_due_week")
          : filter === "starts_today"
            ? t("search.filter_starts_today")
            : filter === "high_priority"
              ? t("search.filter_high")
              : t("search.filter_from_note")
      : completed
        ? t("search.filter_completed")
        : projectId
          ? (projects.find((p) => {
              return p.id === projectId;
            })?.name ?? t("search.in_project"))
          : null;

    // Notes only answer a text search, not a quick filter or a project
    const showNotes =
      input.trim() !== "" && !filter && !completed && !projectId;
    const totalCount =
      tab === "all"
        ? counts.all + projectHits.length + notes.length
        : tab === "tasks"
          ? counts.all
          : tab === "projects"
            ? projectHits.length
            : notes.length;

    let rowRunningIndex = 0;

    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        {/* Field */}
        {variant === "popup" ? (
          <div className="flex h-14 w-full items-center gap-2.5 border-b border-separator px-4">
            <SearchIcon size={18} className="shrink-0 text-ink-secondary" />
            <input
              ref={internalInputRef}
              role="combobox"
              type="search"
              aria-expanded={hasCriteria}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              maxLength={QUERY_MAX}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder={t("search.placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-[17px] text-ink placeholder:text-ink-tertiary focus:outline-none"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 pb-2">
            <div className="flex h-[52px] flex-1 items-center gap-2 rounded-field border border-control bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <SearchIcon size={18} className="shrink-0 text-ink-secondary" />
              <input
                ref={internalInputRef}
                role="combobox"
                type="search"
                aria-expanded={hasCriteria}
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                maxLength={QUERY_MAX}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder={t("search.placeholder")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-body text-ink placeholder:text-ink-tertiary focus:outline-none"
              />
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="focus-ring shrink-0 text-callout font-medium text-ink-secondary hover:text-ink px-1"
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2">
          {!hasCriteria ? (
            /* Home (no criteria) */
            <div className="flex flex-col gap-4 py-2">
              {/* 1. Quick filters */}
              <div>
                <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                  {t("search.quick_filters")}
                </div>
                <div className="flex flex-wrap gap-2 px-3 pb-2">
                  <Chip
                    onClick={() => {
                      setFilter("overdue");
                      setCompleted(false);
                      setProjectId(null);
                    }}
                  >
                    {t("search.filter_overdue")}
                  </Chip>
                  <Chip
                    icon={<CalendarIcon size={16} />}
                    onClick={() => {
                      setFilter("due_week");
                      setCompleted(false);
                      setProjectId(null);
                    }}
                  >
                    {t("search.filter_due_week")}
                  </Chip>
                  <Chip
                    icon={<ClockIcon size={16} />}
                    onClick={() => {
                      setFilter("starts_today");
                      setCompleted(false);
                      setProjectId(null);
                    }}
                  >
                    {t("search.filter_starts_today")}
                  </Chip>
                  <Chip
                    icon={<FlagIcon size={16} />}
                    onClick={() => {
                      setFilter("high_priority");
                      setCompleted(false);
                      setProjectId(null);
                    }}
                  >
                    {t("search.filter_high")}
                  </Chip>
                  <Chip
                    icon={<SparklesIcon size={16} />}
                    onClick={() => {
                      setFilter("from_note");
                      setCompleted(false);
                      setProjectId(null);
                    }}
                  >
                    {t("search.filter_from_note")}
                  </Chip>
                  <Chip
                    icon={<CheckIcon size={16} />}
                    onClick={() => {
                      setFilter(null);
                      setCompleted(true);
                      setProjectId(null);
                    }}
                  >
                    {t("search.filter_completed")}
                  </Chip>
                </div>
              </div>

              {/* 2. Recent searches */}
              {recentList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                      {t("search.recent")}
                    </span>
                    <button
                      type="button"
                      className="focus-ring text-footnote font-medium text-ink-secondary hover:text-ink cursor-pointer"
                      onClick={handleClearRecent}
                    >
                      {t("common.clear")}
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5 px-1">
                    {recentList.map((item) => (
                      <div
                        key={item}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRecentClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRecentClick(item);
                          }
                        }}
                        className="flex items-center gap-3 rounded-tile px-3 py-2 text-left hover:bg-fill cursor-pointer group"
                      >
                        <ClockIcon
                          size={16}
                          className="shrink-0 text-ink-tertiary"
                        />
                        <span className="flex-1 truncate text-body text-ink">
                          {item}
                        </span>
                        <button
                          type="button"
                          className="focus-ring p-1 rounded-full text-ink-tertiary hover:text-ink opacity-70 hover:opacity-100"
                          aria-label={t("search.remove_recent", {
                            query: item,
                          })}
                          onClick={(e) => handleRemoveRecent(e, item)}
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Notes */}
              <div>
                <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                  {t("search.tab_notes")}
                </div>
                <p className="m-0 px-3 pt-1 pb-2 text-footnote text-ink-tertiary">
                  {t("search.no_notes")}
                </p>
              </div>

              {/* 4. In project */}
              {projects.length > 0 && (
                <div>
                  <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                    {t("search.in_project")}
                  </div>
                  <div className="flex flex-wrap gap-2 px-3 pb-2">
                    {projects.map((p) => (
                      <Chip
                        key={p.id}
                        icon={<ProjectDot colour={p.colour} />}
                        onClick={() => {
                          setProjectId(p.id);
                          setFilter(null);
                          setCompleted(false);
                        }}
                      >
                        {p.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Results (criteria set) */
            <div className="flex flex-col gap-2">
              {/* Tab chips row */}
              <div
                role="tablist"
                className="flex flex-wrap items-center gap-1.5 px-1 py-1"
              >
                {activeFilterLabel && (
                  <Chip
                    selected
                    icon={<XIcon size={14} />}
                    onClick={clearActiveConstraint}
                  >
                    {activeFilterLabel}
                  </Chip>
                )}

                <Chip
                  role="tab"
                  aria-selected={tab === "all"}
                  selected={tab === "all"}
                  onClick={() => setTab("all")}
                >
                  {t("list.filter_all")}
                  {!pending &&
                    ` ${counts.all + projectHits.length + notes.length}`}
                </Chip>
                <Chip
                  role="tab"
                  aria-selected={tab === "tasks"}
                  selected={tab === "tasks"}
                  onClick={() => setTab("tasks")}
                >
                  {t("search.tab_tasks")}
                  {!pending && ` ${counts.all}`}
                </Chip>
                <Chip
                  role="tab"
                  aria-selected={tab === "projects"}
                  selected={tab === "projects"}
                  onClick={() => setTab("projects")}
                >
                  {t("search.tab_projects")}
                  {!pending && ` ${projectHits.length}`}
                </Chip>
                <Chip
                  role="tab"
                  aria-selected={tab === "notes"}
                  selected={tab === "notes"}
                  onClick={() => setTab("notes")}
                >
                  {t("search.tab_notes")}
                  {!pending && ` ${notes.length}`}
                </Chip>

                {variant === "popup" && (
                  <div className="ml-auto shrink-0">
                    <Picker
                      label={t("search.any_project")}
                      value={projectId ?? ""}
                      onChange={(val) => setProjectId(val || null)}
                      options={[
                        { value: "", label: t("search.any_project") },
                        ...projects.map((p) => ({
                          value: p.id,
                          label: p.name,
                          leading: <ProjectDot colour={p.colour} />,
                        })),
                      ]}
                    />
                  </div>
                )}
              </div>

              {/* Status announcement */}
              <p className="sr-only" role="status" aria-live="polite">
                {pending ? "" : tc("search.count", totalCount)}
              </p>

              {/* Pending Skeleton */}
              {pending ? (
                <div
                  className="flex flex-col gap-2 p-2"
                  role="status"
                  aria-busy="true"
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex h-12 items-center gap-3 rounded-tile border border-separator/40 bg-surface px-4 py-3"
                    >
                      <div className="size-5 shrink-0 rounded-full bg-fill/80 animate-pulse" />
                      <div
                        className="h-4 rounded-xl bg-fill/80 animate-pulse"
                        style={{
                          width: i === 1 ? "50%" : i === 2 ? "70%" : "40%",
                        }}
                      />
                      <div className="ml-auto h-4 w-16 shrink-0 rounded-full bg-fill/60 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                /* Error */
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-body text-ink-secondary">
                    {t("error.generic")}
                  </p>
                  <Button variant="secondary" onClick={retry}>
                    {t("common.retry")}
                  </Button>
                </div>
              ) : visibleRows.length === 0 ? (
                /* Finished with 0 results */
                <EmptyState
                  title={t("search.no_match", { query: input.trim() })}
                />
              ) : (
                /* Listbox Results */
                <div
                  id={listboxId}
                  role="listbox"
                  className="flex flex-col gap-3"
                >
                  {/* Tasks Section */}
                  {(tab === "all" || tab === "tasks") && tasks.length > 0 && (
                    <div className="flex flex-col">
                      <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                        {t("search.tab_tasks")}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {tasks.map((task) => {
                          const rowIndex = rowRunningIndex++;
                          const isActive = activeIndex === rowIndex;
                          const project = projects.find((p) => {
                            return p.id === task.project_id;
                          });
                          return (
                            <button
                              key={task.id}
                              id={`search-opt-${rowIndex}`}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onClick={() => handleSelectTask(task.id)}
                              className={cx(
                                "flex items-center gap-3 rounded-tile px-3 py-2 text-left w-full cursor-pointer hover:bg-fill transition-colors",
                                isActive && "bg-primary-tint",
                              )}
                            >
                              <span
                                className={cx(
                                  "inline-flex size-[22px] items-center justify-center rounded-full border-[1.5px] transition-colors shrink-0",
                                  task.done
                                    ? "border-ink bg-ink text-surface"
                                    : "border-ink-tertiary",
                                )}
                                aria-hidden="true"
                              >
                                {task.done && (
                                  <CheckIcon size={14} strokeWidth={2.5} />
                                )}
                              </span>

                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="line-clamp-2 text-body font-medium text-ink">
                                  {renderHighlighted(task.title, input)}
                                </span>
                                <span
                                  className="flex flex-wrap items-center gap-1.5 text-footnote text-ink-secondary"
                                  aria-hidden="true"
                                >
                                  <span
                                    className="mr-0.5 inline-block size-2 shrink-0 rounded-full"
                                    style={{
                                      background: `var(--color-project-${project ? project.colour : "gray"})`,
                                    }}
                                  />
                                  <span>
                                    {project ? project.name : t("project.none")}
                                  </span>
                                  {task.due_date && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        {formatDay(task.due_date, today)}
                                        {task.due_time
                                          ? ` ${formatTime(task.due_time, timeFormat)}`
                                          : ""}
                                      </span>
                                    </>
                                  )}
                                  {task.reminder !== "none" && (
                                    <BellIcon
                                      size={13}
                                      className="text-ink-tertiary"
                                    />
                                  )}
                                </span>
                              </div>

                              {task.priority === "high" && !task.done && (
                                <span
                                  className="ml-2 shrink-0 self-center text-error"
                                  data-slot="flag"
                                  aria-hidden="true"
                                >
                                  <FlagIcon size={18} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {nextCursor && (
                        <button
                          type="button"
                          className="focus-ring min-h-11 cursor-pointer rounded-tile border-0 bg-transparent px-2 text-callout font-semibold text-primary hover:bg-fill mt-2 w-full text-center"
                          onClick={() => {
                            void loadMore();
                          }}
                        >
                          {t("search.load_more")}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Notes Section */}
                  {(tab === "all" || tab === "notes") && showNotes && (
                    <div className="flex flex-col">
                      <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                        {t("search.tab_notes")}
                      </div>
                      {notes.length === 0 && (
                        <p className="m-0 px-3 py-2 text-footnote text-ink-tertiary">
                          {t("search.no_notes")}
                        </p>
                      )}
                      <div className="flex flex-col gap-0.5">
                        {notes.map((note) => {
                          const rowIndex = rowRunningIndex++;
                          const isActive = activeIndex === rowIndex;
                          const loc = localDateTime(
                            note.written_at,
                            timeZone(),
                          );
                          const dateLine = `${formatDay(loc.date, today)} ${loc.time}`;

                          return (
                            <button
                              key={note.id}
                              id={`search-opt-${rowIndex}`}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onClick={() => handleSelectNote(note.id)}
                              className={cx(
                                "flex items-start gap-3 rounded-tile px-3 py-2 text-left w-full cursor-pointer hover:bg-fill transition-colors",
                                isActive && "bg-primary-tint",
                              )}
                            >
                              <NotesIcon
                                size={18}
                                className="mt-0.5 shrink-0 text-ink-secondary"
                              />
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="line-clamp-1 text-body font-medium text-ink">
                                  {renderHighlighted(note.title, input)}
                                </span>
                                <span className="line-clamp-2 text-footnote text-ink-secondary">
                                  {renderHighlighted(note.snippet, input)}
                                </span>
                                <span className="text-[12px] text-ink-tertiary">
                                  {dateLine}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Projects Section */}
                  {(tab === "all" || tab === "projects") &&
                    projectHits.length > 0 && (
                      <div className="flex flex-col">
                        <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                          {t("search.tab_projects")}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {projectHits.map((project) => {
                            const rowIndex = rowRunningIndex++;
                            const isActive = activeIndex === rowIndex;
                            return (
                              <button
                                key={project.id}
                                id={`search-opt-${rowIndex}`}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                onClick={() => handleSelectProject(project.id)}
                                className={cx(
                                  "flex items-center gap-3 rounded-tile px-3 py-2 text-left w-full cursor-pointer hover:bg-fill transition-colors",
                                  isActive && "bg-primary-tint",
                                )}
                              >
                                <ProjectDot colour={project.colour} />
                                <span className="flex-1 truncate text-body font-medium text-ink">
                                  {renderHighlighted(project.name, input)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);
