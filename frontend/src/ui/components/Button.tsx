import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "destructive";
export type ButtonSize = "lg" | "md" | "sm";

// daisyUI's btn, sized and coloured to the theme guide (not daisyUI defaults)
const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "bg-primary-tint text-primary",
  outline: "bg-fill text-ink",
  destructive: "bg-danger-tint text-error",
};
const SIZE: Record<ButtonSize, string> = {
  lg: "h-11 min-h-11 text-callout",
  md: "h-11 min-h-11 text-callout",
  sm: "h-[34px] min-h-[34px] rounded-full! px-4 text-footnote",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Request in flight: shows a spinner, keeps the label for screen readers and ignores taps (UX-06). */
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      fullWidth = false,
      busy = false,
      type = "button",
      className,
      children,
      onClick,
      ...rest
    },
    ref,
  ) {
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (busy) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "btn focus-ring gap-2 rounded-xl border-0 px-5 font-semibold shadow-none disabled:opacity-40 aria-busy:cursor-progress",
          VARIANT[variant],
          SIZE[size],
          fullWidth && "w-full",
          className,
        )}
        data-variant={variant}
        aria-busy={busy || undefined}
        onClick={handleClick}
        {...rest}
      >
        {busy ? (
          <>
            <span
              className="loading loading-spinner loading-sm"
              aria-hidden="true"
            />
            <span className="sr-only">{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
