import type { KeyboardEvent, ReactElement } from "react";
import { cx } from "./cx";
import { PlusIcon } from "./icons";

export interface NumberStepperProps {
  id?: string;
  /** Read by screen readers when no visible label points at the field (via `id`). */
  ariaLabel?: string;
  /** 0 while the field is being cleared and retyped; the caller clamps it on save. */
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  className?: string;
  size?: "sm" | "md";
}

/** A whole-number field between − and + buttons, replacing the browser's own spinner arrows. */
export function NumberStepper({
  id,
  ariaLabel,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  className,
  size = "md",
}: NumberStepperProps): ReactElement {
  const isSm = size === "sm";
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const step = (by: number) => onChange(clamp((value || min) + by));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      step(event.key === "ArrowUp" ? 1 : -1);
    }
  };

  const button = cx(
    "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary hover:bg-fill hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent",
    isSm ? "size-7" : "size-9",
  );

  return (
    <div
      className={cx(
        "inline-flex items-center gap-0.5 rounded-field border border-control bg-surface px-1",
        isSm ? "h-9" : "h-11",
        className,
      )}
    >
      <button
        type="button"
        className={button}
        aria-label={decreaseLabel}
        disabled={(value || min) <= min}
        onClick={() => step(-1)}
      >
        <span
          aria-hidden="true"
          className={cx(
            "block h-[2px] rounded bg-current",
            isSm ? "w-2.5" : "w-3.5",
          )}
        />
      </button>
      <input
        id={id}
        aria-label={ariaLabel}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value || ""}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
          onChange(digits ? Math.min(max, Number(digits)) : 0);
        }}
        onKeyDown={onKeyDown}
        className={cx(
          "h-full min-w-0 border-0 bg-transparent text-center font-semibold tabular-nums text-ink outline-none",
          isSm ? "w-9 text-footnote" : "w-11 text-body",
        )}
      />
      <button
        type="button"
        className={button}
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => step(1)}
      >
        <PlusIcon size={isSm ? 14 : 16} />
      </button>
    </div>
  );
}
