import type { ReactNode } from "react";
import { cx } from "../../../components/cx";

/** The small uppercase heading over each group in search. */
export function SearchHeading({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
      {children}
    </div>
  );
}

/**
 * One result in the listbox. The keyboard's current one is outlined; its id lets the field point
 * at it (aria-activedescendant).
 */
export function SearchOption({
  index,
  active,
  onSelect,
  alignTop = false,
  children,
}: {
  index: number;
  active: boolean;
  onSelect: () => void;
  /** Notes start at the top: their text runs to several lines. */
  alignTop?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      id={searchOptionId(index)}
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={cx(
        "flex gap-3 rounded-2xl border bg-surface px-4 py-3 text-left w-full cursor-pointer shadow-xs transition-all",
        alignTop ? "items-start" : "items-center",
        active
          ? "border-primary ring-1 ring-primary/40 shadow-sm"
          : "border-separator hover:border-ink-tertiary hover:shadow-sm",
      )}
    >
      {children}
    </button>
  );
}

export const searchOptionId = (index: number) => `search-opt-${index}`;
