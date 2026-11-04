import type { DayEntry } from "../../domain/entries";
import type { UpcomingFilter } from "../../domain/lists";
import type { Task, WeekStart } from "../../domain/types";
import type { Navigate } from "../shell/routes";

export type UpcomingViewMode = "list" | "board";

export interface UpcomingWeekNavProps {
  monthLabel: string;
  pickedDate: string;
  weekStart: WeekStart;
  weekLabel: string;
  prevDisabled: boolean;
  overdueCount: number;
  onPrev: () => void;
  onNext: () => void;
  onPickDate: (date: string) => void;
  onOverdue: () => void;
}

export interface UpcomingDayStripProps {
  week: string[];
  today: string;
  activeDay?: string;
  countsByDay: Record<string, number>;
  onPickDay: (date: string) => void;
}

export interface UpcomingWeekBarProps {
  anchor: string;
  today: string;
  weekStart: WeekStart;
  countsByDay: Record<string, number>;
  activeDay?: string;
  weekLabel: string;
  onAnchorChange: (date: string) => void;
  onPickDay: (date: string) => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}

export interface UpcomingDayListProps {
  days: string[];
  entriesByDay: Record<string, DayEntry[]>;
  overdueTasks?: Task[];
  today: string;
  selectedTaskId?: string | null;
  navigate?: Navigate;
  onAddTask: (date: string) => void;
}

export interface UpcomingBoardProps {
  days: string[];
  entriesByDay: Record<string, DayEntry[]>;
  overdueTasks?: Task[];
  today: string;
  selectedTaskId?: string | null;
  navigate?: Navigate;
  onAddTask: (date: string) => void;
}

export interface UpcomingScreenProps {
  accountInitial?: string;
  navigate?: Navigate;
  onNewTask?: () => void;
  onAddTask?: (date: string) => void;
  subtitle?: string;
  showHeader?: boolean;
  filter?: UpcomingFilter;
  onFilterChange?: (filter: UpcomingFilter) => void;
  showFilter?: boolean;
  viewMode?: UpcomingViewMode;
  onViewModeChange?: (mode: UpcomingViewMode) => void;
  selectedTaskId?: string | null;
  weekStart?: WeekStart;
  initialView?:
    | { anchor: string; day: string }
    | (() => { anchor: string; day: string } | null)
    | null;
  onViewChange?: (view: { anchor: string; day: string }) => void;
}
