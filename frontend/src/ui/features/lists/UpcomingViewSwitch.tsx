import type { ReactElement } from "react";
import { GridIcon, ListIcon } from "../../components/icons";
import { t } from "../../copy";
import type { UpcomingViewMode } from "./types";

export interface UpcomingViewSwitchProps {
  viewMode: UpcomingViewMode;
  onChange: (mode: UpcomingViewMode) => void;
  className?: string;
}

export function UpcomingViewSwitch({
  viewMode,
  onChange,
  className,
}: UpcomingViewSwitchProps): ReactElement {
  return (
    <div
      role="group"
      aria-label={t("list.view_mode")}
      suppressHydrationWarning
      className={`hidden h-10 items-center rounded-full border border-separator/60 bg-surface p-1 shadow-2xs md:inline-flex ${className ?? ""}`}
    >
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => onChange("list")}
        className={`focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 text-footnote font-medium transition-colors ${
          viewMode === "list"
            ? "bg-primary text-primary-content"
            : "bg-transparent text-ink-secondary row-hover hover:text-ink"
        }`}
        aria-pressed={viewMode === "list"}
        title={t("list.view_list")}
      >
        <ListIcon size={14} />
        <span>{t("list.view_list")}</span>
      </button>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => onChange("board")}
        className={`focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 text-footnote font-medium transition-colors ${
          viewMode === "board"
            ? "bg-primary text-primary-content"
            : "bg-transparent text-ink-secondary row-hover hover:text-ink"
        }`}
        aria-pressed={viewMode === "board"}
        title={t("list.view_board")}
      >
        <GridIcon size={14} />
        <span>{t("list.view_board")}</span>
      </button>
    </div>
  );
}
