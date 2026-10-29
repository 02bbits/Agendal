import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed"
> {
  /** Selected chips are solid ink, never blue. */
  selected?: boolean;
  icon?: ReactNode;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, icon, type = "button", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cx(
        "btn focus-ring relative h-8 min-h-8 rounded-full border-0 bg-fill px-3 text-footnote font-medium text-ink shadow-none after:absolute after:inset-x-0 after:-inset-y-1.5 aria-checked:bg-neutral aria-checked:text-neutral-content aria-pressed:bg-neutral aria-pressed:text-neutral-content disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
});
