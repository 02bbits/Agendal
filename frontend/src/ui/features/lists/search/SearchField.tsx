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
      <SearchIcon
        size={popup ? 18 : 16}
        className={cx(
          "shrink-0 pointer-events-none",
          popup ? "text-ink-secondary" : "text-ink-tertiary",
        )}
      />
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
      <div className="flex h-14 w-full shrink-0 items-center gap-2.5 border-b border-separator px-4">
        {field}
      </div>
    );

  return (
    <div className="px-4">
      <h1 className="mt-3 px-1 text-[30px] leading-[36px] font-bold tracking-[-0.02em] text-ink">
        {t("nav.search")}
      </h1>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-field bg-fill px-3 field-ring">
          {field}
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring inline-flex min-h-10 shrink-0 items-center px-1.5 link-swipe text-callout font-medium text-ink-secondary hover:text-ink"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
