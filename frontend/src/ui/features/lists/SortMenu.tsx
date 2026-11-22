import { useCallback, useRef, useState } from "react";
import { ArrowUpDownIcon, CheckIcon } from "../../components/icons";
import { useMenuDismiss } from "../../components/useMenuDismiss";
import { t } from "../../copy";
import type { SortMode } from "../../domain/order";
import { cx } from "../../components/cx";
import { useSortMode, type SortList } from "./useSortMode";

export interface SortMenuProps {
  list: SortList;
  /** The list's name for the button's label: "Sort Today". */
  listName: string;
  /** Writes keys in rule order and switches to manual (Spec 02 §2.1, "Sort by rules"). */
  onSortByRules: () => void;
}

const ITEM =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-footnote font-medium text-ink transition-colors hover:bg-fill";

/** Smart or manual order for one list, and Sort by rules (#178). */
export function SortMenu({ list, listName, onSortByRules }: SortMenuProps) {
  const [mode, setMode] = useSortMode(list);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss(open, close, menu, trigger);

  const choose = (action: () => void) => {
    setOpen(false);
    trigger.current?.focus();
    action();
  };
  const modeItem = (value: SortMode, label: string) => (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={mode === value}
      className={ITEM}
      onClick={() => choose(() => setMode(value))}
    >
      <span className="flex-1">{label}</span>
      {mode === value && <CheckIcon size={15} />}
    </button>
  );

  return (
    <div ref={menu} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={t("list.sort", { list: listName })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 transition-colors hover:bg-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-primary",
          mode === "manual" ? "text-ink" : "text-ink-tertiary",
        )}
      >
        <ArrowUpDownIcon size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-30 min-w-44 rounded-xl border border-separator bg-surface p-1 shadow-lg"
        >
          {modeItem("smart", t("list.sort_smart"))}
          {modeItem("manual", t("list.sort_manual"))}
          <div className="my-1 h-px bg-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => choose(onSortByRules)}
          >
            {t("list.sort_by_rules")}
          </button>
        </div>
      )}
    </div>
  );
}
