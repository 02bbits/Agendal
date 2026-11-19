import type { ReactElement } from "react";
import { cx } from "../../../components/cx";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  RotateCcwIcon,
} from "../../../components/icons";
import { Switch } from "../../../components/Switch";
import { t } from "../../../copy";
import { SettingsHeading } from "../SettingsSection";
import { SidebarPreview } from "./SidebarPreview";
import { TAB_ICON } from "../../shell/tabIcons";
import { SIDEBAR_TAB_META } from "./sidebarTabMeta";
import { useSidebarTabs } from "./useSidebarTabs";

const REORDER_BUTTON =
  "focus-ring rounded p-0.5 text-ink-tertiary hover:text-ink hover:bg-fill disabled:opacity-20 disabled:cursor-default cursor-pointer transition-colors";

/** Settings > Sidebar (desktop): task counts, and which tabs the sidebar shows in what order. */
export function SidebarTab(): ReactElement {
  const sidebar = useSidebarTabs();
  const lastIndex = sidebar.order.length - 1;

  return (
    <>
      <section className="space-y-3">
        <Switch
          label={t("settings.sidebar_show_task_counts")}
          checked={sidebar.showCounts}
          onChange={sidebar.changeShowCounts}
          divider={false}
          className="py-0"
        />
        <SidebarPreview
          tabs={sidebar.shownTabs}
          showCounts={sidebar.showCounts}
        />
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <SettingsHeading>{t("settings.sidebar_nav_heading")}</SettingsHeading>
          <button
            type="button"
            onClick={sidebar.reset}
            className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1 text-footnote font-medium text-ink-secondary hover:text-ink hover:bg-fill/40 transition-colors cursor-pointer"
            title={t("settings.reset_default")}
          >
            <RotateCcwIcon size={14} />
            <span>{t("settings.reset_default")}</span>
          </button>
        </div>
        <p className="text-footnote text-ink-secondary mb-4">
          {t("settings.sidebar_nav_desc")}
        </p>
        <div
          className="flex flex-col rounded-xl border border-separator/40 bg-fill/30 divide-y divide-separator/30 px-3 py-1"
          role="list"
          aria-label={t("settings.sidebar_nav_heading")}
        >
          {sidebar.order.map((tab, index) => {
            const Icon = TAB_ICON[tab];
            const label = t(SIDEBAR_TAB_META[tab].label);
            const itemProps = sidebar.getItemProps(tab);
            const handleProps = sidebar.getHandleProps(tab);
            return (
              <div
                key={tab}
                role="listitem"
                ref={itemProps.ref}
                style={itemProps.style}
                data-sortable-id={itemProps["data-sortable-id"]}
                className={cx(
                  "flex items-center justify-between py-2 px-1 rounded-lg transition-colors select-none",
                  itemProps.className,
                )}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span
                    {...handleProps}
                    className={cx(
                      "cursor-grab active:cursor-grabbing text-ink-tertiary/60 hover:text-ink transition-colors p-1",
                      handleProps.className,
                    )}
                    title={t("settings.drag_reorder")}
                  >
                    <GripVerticalIcon size={16} />
                  </span>

                  {/* Up and down, for keyboards and screen readers */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => sidebar.moveBy(index, -1)}
                      className={REORDER_BUTTON}
                      aria-label={`${t("settings.reorder_up")}: ${label}`}
                    >
                      <ArrowUpIcon size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={index === lastIndex}
                      onClick={() => sidebar.moveBy(index, 1)}
                      className={REORDER_BUTTON}
                      aria-label={`${t("settings.reorder_down")}: ${label}`}
                    >
                      <ArrowDownIcon size={12} />
                    </button>
                  </div>

                  <span className="text-ink-secondary shrink-0">
                    <Icon size={18} />
                  </span>
                  <span className="text-callout font-medium text-ink truncate">
                    {label}
                  </span>
                </div>

                <label className="flex items-center cursor-pointer p-1">
                  <input
                    type="checkbox"
                    checked={sidebar.isEnabled(tab)}
                    disabled={sidebar.isLastEnabled(tab)}
                    onChange={() => sidebar.toggle(tab)}
                    className="checkbox checkbox-primary size-5 rounded-md focus-ring"
                    aria-label={label}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
