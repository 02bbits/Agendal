import { useRef, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import type { TabId } from "../../shell/routes";
import { useFlipChildren } from "../../shell/useFlipChildren";
import { TAB_ICON } from "../../shell/tabIcons";
import { SIDEBAR_TAB_META } from "./sidebarTabMeta";

/**
 * A small sidebar as the settings make it: only the tabs that show, the first one current, with
 * sample counts while counts are on. The tabs slide when the order or the set changes.
 */
export function SidebarPreview({
  tabs,
  showCounts,
}: {
  tabs: TabId[];
  showCounts: boolean;
}): ReactElement {
  const listRef = useRef<HTMLDivElement>(null);
  useFlipChildren(listRef, tabs.join("|"));

  return (
    <div className="rounded-xl border border-separator/50 bg-fill/20 p-4 space-y-2.5">
      <span className="text-caption font-semibold uppercase tracking-wider text-ink-tertiary">
        {t("settings.sidebar_preview")}
      </span>
      <div
        ref={listRef}
        className="rounded-lg border border-separator/40 bg-surface/70 p-2.5 max-w-[260px] space-y-1 shadow-xs"
      >
        {tabs.map((tab, index) => {
          const { label, sampleCount } = SIDEBAR_TAB_META[tab];
          const Icon = TAB_ICON[tab];
          const isCurrent = index === 0;
          return (
            <div
              key={tab}
              data-flip-key={tab}
              className={cx(
                "flex items-center justify-between px-2.5 py-1.5 rounded-md text-footnote transition-colors",
                isCurrent
                  ? "bg-primary/15! text-primary! font-semibold"
                  : "text-ink-secondary",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon size={15} />
                <span>{t(label)}</span>
              </span>
              {showCounts && (
                <span
                  className={cx(
                    "text-caption font-semibold tabular-nums",
                    isCurrent ? "text-primary/90" : "text-ink-tertiary",
                  )}
                >
                  {sampleCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
