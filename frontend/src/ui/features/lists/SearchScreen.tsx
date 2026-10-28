import { useEffect, useRef, useState } from "react";
import { t, tc } from "../../copy";
import { ChipGroup } from "../../components/ChipGroup";
import { EmptyState } from "../../components/EmptyState";
import { SearchIcon } from "../../components/icons";
import { NavBar } from "../../components/NavBar";
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
/** Results per page (LV §2.3). */
export const SEARCH_PAGE = 50;

export interface SearchScreenProps {
  onBack: () => void;
  navigate?: Navigate;
  /** Offline: results come from the device, which keeps completed tasks for 90 days (AP). */
  offline?: boolean;
}

/** Search (LV-3): titles and notes, completed included, accent-insensitive, with All / Open / Completed counts. */
export function SearchScreen({
  onBack,
  navigate,
  offline = false,
}: SearchScreenProps) {
  const store = useTaskStore();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("all");
  const [paging, setPaging] = useState({ key: "", shown: SEARCH_PAGE });
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => field.current?.focus(), []);
  useEffect(() => {
    if (input === query) return;
    const timer = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, query]);

  const { items, counts } = searchTasks(store.tasks, query, status);
  const pageKey = `${status}:${query}`;
  const shown = paging.key === pageKey ? paging.shown : SEARCH_PAGE;
  const hasQuery = query.trim().length > 0;

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

      {!hasQuery ? (
        <EmptyState title={t("search.hint")} />
      ) : items.length === 0 ? (
        <EmptyState title={t("search.no_match", { query: query.trim() })} />
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {items.slice(0, shown).map((x) => (
            <TaskRow
              key={x.id}
              task={x}
              project={store.projectOf(x)}
              today={store.today}
              timeFormat={store.timeFormat}
              showDue
              onToggle={store.toggle}
              navigate={navigate}
              renderTitle={(title) =>
                highlightParts(title, query).map((part, i) =>
                  part.match ? (
                    <mark key={i}>{part.text}</mark>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )
              }
            />
          ))}
        </ul>
      )}
      {items.length > shown && (
        <button
          type="button"
          className="focus-ring min-h-11 cursor-pointer rounded-tile border-0 bg-transparent px-2 text-callout font-semibold text-primary mt-3 w-full"
          onClick={() =>
            setPaging({ key: pageKey, shown: shown + SEARCH_PAGE })
          }
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
