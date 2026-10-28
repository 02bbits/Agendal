import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface ChipOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

export interface ChipGroupProps<V extends string> {
  label: string;
  /** Show the group label visibly (as a field label) or only to screen readers. */
  showLabel?: boolean;
  options: ReadonlyArray<ChipOption<V>>;
  value: V;
  onChange: (value: V) => void;
}

/** Single-choice chips as a radio group (A11Y-52): selected is ink, arrow keys move and select. */
export function ChipGroup<V extends string>({
  label,
  showLabel = false,
  options,
  value,
  onChange,
}: ChipGroupProps<V>) {
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span
        id={labelId}
        className={
          showLabel ? "text-footnote font-medium text-ink-secondary" : "sr-only"
        }
      >
        {label}
      </span>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className="btn focus-ring relative h-8 min-h-8 rounded-full border-0 bg-fill px-3 text-footnote font-medium text-ink shadow-none after:absolute after:inset-x-0 after:-inset-y-1.5 aria-checked:bg-neutral aria-checked:text-neutral-content aria-pressed:bg-neutral aria-pressed:text-neutral-content disabled:opacity-40"
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {option.icon && <span aria-hidden="true">{option.icon}</span>}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
