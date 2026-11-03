import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed"
> {
  /** Selected chips are solid accent (ink). */
  selected?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    selected = false,
    icon,
    size = "sm",
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cx(
        "btn focus-ring relative rounded-full border-0 bg-primary-tint font-medium text-primary shadow-none after:absolute after:inset-x-0 after:-inset-y-2 aria-checked:bg-primary aria-checked:text-primary-content aria-pressed:bg-primary aria-pressed:text-primary-content disabled:opacity-40",
        size === "md"
          ? "h-10 min-h-10 px-4 text-callout"
          : "h-7 min-h-7 px-3 text-footnote",
        className,
      )}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
});
