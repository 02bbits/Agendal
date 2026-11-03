import { useEffect, useRef, useState } from "react";
import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/ChipGroup";
import { EmptyState } from "../../components/EmptyState";
import { SearchIcon } from "../../components/icons";
import { NavBar } from "../../components/NavBar";
import type { Task } from "../../domain/types";
import {
  highlightParts,
  QUERY_MAX,
  searchTasks,
  type SearchStatus,
} from "../../domain/search";
import type { Navigate } from "../shell/routes";
import { useTaskStore } from "../tasks/store";
import { TaskRow } from "../tasks/TaskRow";

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_SKELETON_MS = 300;
/** Results per page (LV §2.3). */
export const SEARCH_PAGE = 50;

export type SearchResultPromise = Promise<{
  items: Task[];
  counts: { all: number; open: number; completed: number };
  next_cursor: string | null;
}>;

export interface SearchScreenProps {
  onBack: () => void;
  navigate?: Navigate;
  /** Offline: results come from the device, which keeps completed tasks for 90 days (AP). */
  offline?: boolean;
  searchFn?: (params: {
    q: string;
    status: SearchStatus;
    cursor?: string;
  }) => SearchResultPromise;
}

/** Search (LV-3): titles and notes, completed included, accent-insensitive, with All / Open / Completed counts. */
export function SearchScreen({
  onBack,
  navigate,
  offline = false,
  searchFn,
}: SearchScreenProps) {
  const store = useTaskStore();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("all");
  const [paging, setPaging] = useState({ key: "", shown: SEARCH_PAGE });
  const [retrySeq, setRetrySeq] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  const activeSearch = searchFn ?? (!offline ? store.api.search : undefined);

  const [remoteResults, setRemoteResults] = useState<{
    items: Task[];
    counts: { all: number; open: number; completed: number };
    nextCursor: string | null;
  }>({
    items: [],
    counts: { all: 0, open: 0, completed: 0 },
    nextCursor: null,
  });
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => field.current?.focus(), []);

  useEffect(() => {
    if (input === query) return;
    const timer = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, query]);

  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    if (!activeSearch || !hasQuery) return;

    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLoading(true);
    setError(false);

    const skeletonTimer = setTimeout(() => {
      setShowSkeleton(true);
    }, SEARCH_SKELETON_MS);

    activeSearch({ q: query.trim(), status })
      .then((res) => {
        if (cancelled) return;
        setRemoteResults({
          items: res.items,
          counts: res.counts,
          nextCursor: res.next_cursor,
        });
        setLoading(false);
        setShowSkeleton(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
        setShowSkeleton(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(skeletonTimer);
    };
  }, [activeSearch, query, status, hasQuery, retrySeq]);

  const localResult = searchTasks(store.tasks, query, status);
  const items = !hasQuery
    ? []
    : activeSearch
      ? remoteResults.items
      : localResult.items;
  const counts = !hasQuery
    ? { all: 0, open: 0, completed: 0 }
    : activeSearch
      ? remoteResults.counts
      : localResult.counts;
  const pageKey = `${status}:${query}`;
  const shown = paging.key === pageKey ? paging.shown : SEARCH_PAGE;
  const hasMore = activeSearch
    ? Boolean(remoteResults.nextCursor)
    : shown < items.length;
  const displayedItems = activeSearch ? items : items.slice(0, shown);

  const handleLoadMore = async () => {
    if (activeSearch) {
      if (!remoteResults.nextCursor || loadingMore) return;
      setLoadingMore(true);
      try {
        const res = await activeSearch({
          q: query.trim(),
          status,
          cursor: remoteResults.nextCursor,
        });
        setRemoteResults((prev) => ({
          items: [...prev.items, ...res.items],
          counts: res.counts,
          nextCursor: res.next_cursor,
        }));
      } catch {
        // silent fail on load more
      } finally {
        setLoadingMore(false);
      }
    } else {
      setPaging({ key: pageKey, shown: shown + SEARCH_PAGE });
    }
  };

  const handleToggle = (task: Task) => {
    if (activeSearch) {
      setRemoteResults((prev) => {
        const isCompleting = !task.done;
        return {
          ...prev,
          items: prev.items.map((t) => {
            if (t.id !== task.id) return t;
            return {
              ...t,
              done: isCompleting,
              done_at: isCompleting ? store.clock.now().toISOString() : null,
            };
          }),
          counts: {
            ...prev.counts,
            open: isCompleting
              ? Math.max(0, prev.counts.open - 1)
              : prev.counts.open + 1,
            completed: isCompleting
              ? prev.counts.completed + 1
              : Math.max(0, prev.counts.completed - 1),
          },
        };
      });
    }
    store.toggle(task);
  };

  return (
    <div className="pb-8">
      <NavBar backLabel={t("common.back")} onBack={onBack} />
      <form
        role="search"
        className="flex h-[52px] items-center gap-2 rounded-field border border-control bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input);
        }}
      >
        <SearchIcon size={18} className="shrink-0 text-ink-secondary" />
        <input
          ref={field}
          type="search"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-body text-ink placeholder:text-ink-tertiary focus:outline-none"
          aria-label={t("search.placeholder")}
          placeholder={t("search.placeholder")}
          value={input}
          maxLength={QUERY_MAX}
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
        />
      </form>

      {hasQuery && (
        <div className="mt-4">
          <ChipGroup
            label={t("search.filter_label")}
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: `${t("list.filter_all")} ${counts.all}` },
              {
                value: "open",
                label: `${t("search.filter_open")} ${counts.open}`,
              },
              {
                value: "completed",
                label: `${t("search.filter_completed")} ${counts.completed}`,
              },
            ]}
          />
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {hasQuery ? tc("search.count", counts[status]) : ""}
      </p>

      {error ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-body text-ink-secondary">{t("error.generic")}</p>
          <Button variant="secondary" onClick={() => setRetrySeq((s) => s + 1)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : showSkeleton ? (
        <div
          className="mt-3 flex flex-col gap-2"
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
                style={{ width: i === 1 ? "50%" : i === 2 ? "70%" : "40%" }}
              />
              <div className="ml-auto h-4 w-16 shrink-0 rounded-full bg-fill/60 animate-pulse" />
            </div>
          ))}
        </div>
      ) : !hasQuery ? (
        <EmptyState title={t("search.hint")} />
      ) : items.length === 0 && !loading ? (
        <EmptyState title={t("search.no_match", { query: query.trim() })} />
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {displayedItems.map((x) => (
            <TaskRow
              key={x.id}
              task={x}
              project={store.projectOf(x)}
              today={store.today}
              timeFormat={store.timeFormat}
              showDue
              onToggle={handleToggle}
              navigate={navigate}
              renderTitle={(title) =>
                highlightParts(title, query).map((part, i) => {
                  if (part.match) {
                    return <mark key={i}>{part.text}</mark>;
                  }
                  return <span key={i}>{part.text}</span>;
                })
              }
            />
          ))}
        </ul>
      )}
      {hasMore && (
        <button
          type="button"
          className="focus-ring min-h-11 cursor-pointer rounded-tile border-0 bg-transparent px-2 text-callout font-semibold text-primary mt-3 w-full"
          onClick={handleLoadMore}
        >
          {t("search.load_more")}
        </button>
      )}
      {offline && hasQuery && (
        <p className="mt-4 text-center text-footnote text-ink-secondary">
          {t("search.offline")}
        </p>
      )}
    </div>
  );
}
