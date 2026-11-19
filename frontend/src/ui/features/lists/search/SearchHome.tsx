import type { ComponentType } from "react";
import { Chip } from "../../../components/Chip";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  SparklesIcon,
  XIcon,
} from "../../../components/icons";
import { ProjectDot } from "../../../components/ProjectDot";
import { t, type CopyKey } from "../../../copy";
import type { SearchFilter } from "../../../domain/search";
import type { Project } from "../../../domain/types";
import { SearchHeading } from "./SearchSection";

/** A quick filter: one of the search filters, or Completed. */
export type QuickFilter = SearchFilter | "completed";

export const FILTER_LABEL: Record<QuickFilter, CopyKey> = {
  overdue: "search.filter_overdue",
  due_week: "search.filter_due_week",
  starts_today: "search.filter_starts_today",
  high_priority: "search.filter_high",
  from_note: "search.filter_from_note",
  completed: "search.filter_completed",
};

const QUICK_FILTERS: ReadonlyArray<{
  filter: QuickFilter;
  Icon?: ComponentType<{ size?: number }>;
}> = [
  { filter: "overdue" },
  { filter: "due_week", Icon: CalendarIcon },
  { filter: "starts_today", Icon: ClockIcon },
  { filter: "high_priority", Icon: FlagIcon },
  { filter: "from_note", Icon: SparklesIcon },
  { filter: "completed", Icon: CheckIcon },
];

/**
 * Search before anything is typed: quick filters, recent searches, a word on notes, and the
 * projects to search in.
 */
export function SearchHome({
  projects,
  recent,
  onFilter,
  onProject,
  onRecent,
  onRemoveRecent,
  onClearRecent,
}: {
  projects: Project[];
  recent: string[];
  onFilter: (filter: QuickFilter) => void;
  onProject: (id: string) => void;
  onRecent: (query: string) => void;
  onRemoveRecent: (query: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 py-2">
      <div>
        <SearchHeading>{t("search.quick_filters")}</SearchHeading>
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {QUICK_FILTERS.map(({ filter, Icon }) => (
            <Chip
              key={filter}
              icon={Icon && <Icon size={16} />}
              onClick={() => onFilter(filter)}
            >
              {t(FILTER_LABEL[filter])}
            </Chip>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
              {t("search.recent")}
            </span>
            <button
              type="button"
              className="focus-ring link-swipe text-footnote font-medium text-ink-secondary hover:text-ink cursor-pointer"
              onClick={onClearRecent}
            >
              {t("common.clear")}
            </button>
          </div>
          <div className="flex flex-col gap-0.5 px-1">
            {recent.map((query) => (
              <div
                key={query}
                role="button"
                tabIndex={0}
                onClick={() => onRecent(query)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRecent(query);
                  }
                }}
                className="flex items-center gap-3 rounded-tile px-3 py-2 text-left hover:bg-fill cursor-pointer group"
              >
                <ClockIcon size={16} className="shrink-0 text-ink-tertiary" />
                <span className="flex-1 truncate text-body text-ink">
                  {query}
                </span>
                <button
                  type="button"
                  className="focus-ring p-1 rounded-full text-ink-tertiary hover:text-ink opacity-70 hover:opacity-100"
                  aria-label={t("search.remove_recent", { query })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecent(query);
                  }}
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SearchHeading>{t("search.tab_notes")}</SearchHeading>
        <p className="m-0 px-3 pt-1 pb-2 text-footnote text-ink-tertiary">
          {t("search.no_notes")}
        </p>
      </div>

      {projects.length > 0 && (
        <div>
          <SearchHeading>{t("search.in_project")}</SearchHeading>
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {projects.map((project) => (
              <Chip
                key={project.id}
                icon={<ProjectDot colour={project.colour} />}
                onClick={() => onProject(project.id)}
              >
                {project.name}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
