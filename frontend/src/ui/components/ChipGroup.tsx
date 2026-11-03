import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Chip } from "./Chip";

export interface ChipOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

export interface ChipGroupProps<V extends string> {
  label: string;
  showLabel?: boolean;
  options: ReadonlyArray<ChipOption<V>>;
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md";
  itemRef?: (value: V, el: HTMLButtonElement | null) => void;
}

export function ChipGroup<V extends string>({
  label,
  showLabel = false,
  options,
  value,
  onChange,
  size = "sm",
  itemRef,
}: ChipGroupProps<V>) {
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const isNext = e.key === "ArrowRight" || e.key === "ArrowDown";
    const isPrev = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!isNext && !isPrev) return;
    e.preventDefault();
    const next = (index + (isNext ? 1 : -1) + options.length) % options.length;
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
            <Chip
              key={option.value}
              size={size}
              ref={(el) => {
                refs.current[index] = el;
                itemRef?.(option.value, el);
              }}
              role="radio"
              aria-checked={checked}
              aria-pressed={undefined}
              tabIndex={checked ? 0 : -1}
              icon={option.icon}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              {option.label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
