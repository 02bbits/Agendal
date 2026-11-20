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
}: NumberStepperProps): ReactElement {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const step = (by: number) => onChange(clamp((value || min) + by));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      step(event.key === "ArrowUp" ? 1 : -1);
    }
  };

  const button =
    "focus-ring inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-secondary hover:bg-fill hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div
      className={cx(
        "inline-flex h-11 items-center gap-0.5 rounded-field border border-control bg-surface px-1",
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
          className="block h-[2px] w-3.5 rounded bg-current"
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
        className="h-full w-11 min-w-0 border-0 bg-transparent text-center text-body font-semibold tabular-nums text-ink outline-none"
      />
      <button
        type="button"
        className={button}
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => step(1)}
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
