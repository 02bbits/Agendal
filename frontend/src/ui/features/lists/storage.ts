import { useEffect, useState } from "react";
import type { UpcomingFilter } from "../../domain/lists";
import type { UpcomingViewMode } from "./types";

const FILTER_KEY = "agendal.upcoming.filter";
const VIEW_MODE_KEY = "agendal.upcoming.view_mode";

export function readFilter(): UpcomingFilter {
  try {
    const saved = localStorage.getItem(FILTER_KEY);
    return saved === "scheduled" || saved === "due" ? saved : "all";
  } catch {
    return "all";
  }
}

export function writeFilter(filter: UpcomingFilter): void {
  try {
    localStorage.setItem(FILTER_KEY, filter);
  } catch {}
}

export function readViewMode(): UpcomingViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "board" || saved === "grid") return "board";
    return "list";
  } catch {
    return "list";
  }
}

export function writeViewMode(mode: UpcomingViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {}
}

export function useUpcomingPreferences(
  props: {
    filter?: UpcomingFilter;
    onFilterChange?: (f: UpcomingFilter) => void;
    viewMode?: UpcomingViewMode;
    onViewModeChange?: (m: UpcomingViewMode) => void;
  },
  onSwitchToBoard?: () => void,
) {
  const [internalFilter, setInternalFilter] = useState<UpcomingFilter>("all");
  const filter = props.filter !== undefined ? props.filter : internalFilter;

  const [internalViewMode, setInternalViewMode] =
    useState<UpcomingViewMode>("list");
  const viewMode =
    props.viewMode !== undefined ? props.viewMode : internalViewMode;

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setInternalFilter(readFilter());
    setInternalViewMode(readViewMode());
  }, []);

  const chooseFilter = (next: UpcomingFilter) => {
    if (props.filter === undefined) setInternalFilter(next);
    props.onFilterChange?.(next);
    writeFilter(next);
  };

  const chooseViewMode = (next: UpcomingViewMode) => {
    if (next === "board") onSwitchToBoard?.();
    if (props.viewMode === undefined) setInternalViewMode(next);
    props.onViewModeChange?.(next);
    writeViewMode(next);
  };

  return { filter, chooseFilter, viewMode, chooseViewMode };
}
