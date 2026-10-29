import { useId, useRef, type KeyboardEvent } from "react";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedProps<V extends string> {
  label: string;
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (value: V) => void;
}

/** Segmented control as a radio group: arrow keys move and select (roving tabindex). */
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<V>) {
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
    <div
      className="flex gap-0.5 rounded-segmented bg-fill p-0.5"
      role="radiogroup"
      aria-labelledby={labelId}
    >
      <span id={labelId} className="sr-only">
        {label}
      </span>
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
            className="focus-ring relative min-h-8 flex-1 cursor-pointer rounded-tile border-0 bg-transparent text-footnote font-medium text-ink-secondary after:absolute after:inset-x-0 after:-inset-y-1.5 aria-checked:bg-fill-thumb aria-checked:text-ink aria-checked:shadow-xs"
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
