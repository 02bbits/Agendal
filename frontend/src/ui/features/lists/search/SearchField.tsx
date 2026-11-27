import type { KeyboardEvent, RefObject } from "react";
import { cx } from "../../../components/cx";
import { SearchIcon } from "../../../components/icons";
import { t } from "../../../copy";
import { QUERY_MAX } from "../../../domain/search";

/**
 * The search field, a combobox over the results listbox. In the popup it fills the top bar; on
 * the phone's Search screen it is a rounded field with Cancel beside it.
 */
export function SearchField({
  variant,
  inputRef,
  value,
  onChange,
  onKeyDown,
  expanded,
  listboxId,
  activeOptionId,
  onCancel,
}: {
  variant: "popup" | "screen";
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  value: string;
  onChange: (value: string) => void;
  expanded: boolean;
  listboxId: string;
  activeOptionId?: string;
  onCancel?: () => void;
}) {
  const popup = variant === "popup";
  const field = (
    <>
      <SearchIcon size={18} className="shrink-0 text-ink-secondary" />
      <input
        ref={inputRef}
        role="combobox"
        type="search"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        maxLength={QUERY_MAX}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder={t("search.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cx(
          "h-full min-w-0 flex-1 border-0 bg-transparent text-ink placeholder:text-ink-tertiary focus:outline-none",
          popup ? "text-[17px]" : "text-body",
        )}
      />
    </>
  );

  if (popup)
    return (
      <div className="flex h-14 w-full items-center gap-2.5 border-b border-separator px-4">
        {field}
      </div>
    );

  return (
    <div className="flex items-center gap-2.5 px-gutter pt-2 pb-2">
      <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-field border border-control bg-surface px-3.5 field-ring">
        {field}
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring inline-flex min-h-11 shrink-0 items-center px-1.5 link-swipe text-callout font-medium text-ink-secondary hover:text-ink"
        >
          {t("common.cancel")}
        </button>
      )}
    </div>
  );
}
