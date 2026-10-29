import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label"
> {
  /** Accessible name; required because the button shows only an icon (NF-2). */
  label: string;
  icon: ReactNode;
  plain?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, icon, plain = false, type = "button", className, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cx(
          "btn btn-circle focus-ring size-11 min-h-11 border-0 bg-fill text-ink shadow-none disabled:opacity-40",
          plain && "bg-transparent!",
          className,
        )}
        {...rest}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    );
  },
);
