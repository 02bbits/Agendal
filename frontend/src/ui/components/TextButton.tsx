import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Request in flight: ignores taps and dims the label. */
  busy?: boolean;
}

/** A text-only button (Show all, Load more): no fill, an underline swipes in on hover. */
export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
  function TextButton(
    { busy = false, type = "button", className, children, onClick, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-busy={busy || undefined}
        className={cx(
          "focus-ring min-h-11 cursor-pointer border-0 bg-transparent px-1 text-callout font-semibold text-primary disabled:cursor-default disabled:opacity-40 aria-busy:cursor-progress aria-busy:opacity-60",
          className,
        )}
        onClick={(event) => {
          if (busy) event.preventDefault();
          else onClick?.(event);
        }}
        {...rest}
      >
        <span className="link-swipe">{children}</span>
      </button>
    );
  },
);
