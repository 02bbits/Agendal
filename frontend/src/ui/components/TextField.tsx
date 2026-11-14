import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "./cx";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  label: string;
  helper?: string;
  /** Shown under the field. The caller decides when (on blur and submit, UX-07). */
  error?: string;
  id?: string;
  /** Optional icon or adornment on the left edge. */
  leading?: ReactNode;
  /** A control inside the field on the right, e.g. the password show/hide button. */
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    {
      label,
      helper,
      error,
      id,
      className,
      type = "text",
      leading,
      trailing,
      "aria-describedby": extraDescribedBy,
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? `field-${autoId}`;
    const helperId = helper ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    // The caller's ids (e.g. a strength meter) add to the error and helper, never replace them
    const describedBy =
      [errorId, helperId, extraDescribedBy].filter(Boolean).join(" ") ||
      undefined;

    return (
      <div className={cx("flex flex-col gap-1.5", className)}>
        <label
          className="text-footnote font-medium text-ink-secondary"
          htmlFor={inputId}
        >
          {label}
        </label>
        <div
          className={cx(
            "field-box field-ring flex h-11 items-center rounded-field border border-control bg-surface has-[[aria-invalid=true]]:border-error has-[:disabled]:opacity-40",
            error && "border-error",
            rest.disabled && "opacity-40",
          )}
        >
          {leading != null && (
            <span
              aria-hidden="true"
              className="box-content flex size-5 shrink-0 items-center justify-center pl-3.5 text-ink-tertiary"
            >
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cx(
              "flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-body text-ink placeholder:text-ink-tertiary",
              leading != null ? "px-3.5" : "px-4",
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
          {trailing != null && (
            <div className="flex shrink-0 items-center pr-1">{trailing}</div>
          )}
        </div>
        {error && (
          <p id={errorId} className="m-0 text-footnote text-error">
            {error}
          </p>
        )}
        {helper && (
          <p id={helperId} className="m-0 text-footnote text-ink-secondary">
            {helper}
          </p>
        )}
      </div>
    );
  },
);
