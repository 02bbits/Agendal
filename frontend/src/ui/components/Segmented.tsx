import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedProps<V extends string> {
  label?: string;
  "aria-labelledby"?: string;
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (value: V, event?: React.MouseEvent<HTMLButtonElement>) => void;
  size?: "md" | "lg";
  className?: string;
}

/** Segmented control as a radio group: arrow keys move and select (roving tabindex). */
export function Segmented<V extends string>({
  label,
  "aria-labelledby": ariaLabelledBy,
  options,
  value,
  onChange,
  size = "md",
  className,
}: SegmentedProps<V>) {
  const autoLabelId = useId();
  const labelId = ariaLabelledBy ?? autoLabelId;
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

  const isLg = size === "lg";

  return (
    <div
      className={cx(
        isLg
          ? "inline-flex gap-1 rounded-full bg-fill/50 p-1 border border-separator/40"
          : "flex gap-0.5 rounded-segmented bg-fill p-0.5",
        className,
      )}
      role="radiogroup"
      aria-labelledby={labelId}
    >
      {!ariaLabelledBy && label && (
        <span id={autoLabelId} className="sr-only">
          {label}
        </span>
      )}
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
            className={cx(
              "focus-ring relative flex-1 cursor-pointer border-0 bg-transparent transition-all duration-150 select-none whitespace-nowrap",
              isLg
                ? "min-h-10 rounded-full py-2 px-5 text-callout font-medium text-ink-secondary hover:text-ink aria-checked:bg-surface-elevated aria-checked:text-ink aria-checked:font-semibold aria-checked:shadow-xs aria-checked:ring-1 aria-checked:ring-separator/40"
                : "min-h-8 rounded-tile px-2 text-footnote font-medium text-ink-secondary after:absolute after:inset-x-0 after:-inset-y-1.5 aria-checked:bg-fill-thumb aria-checked:text-ink aria-checked:shadow-xs",
            )}
            onClick={(event) => onChange(option.value, event)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {option.icon && (
                <span aria-hidden="true" className="inline-flex shrink-0">
                  {option.icon}
                </span>
              )}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
