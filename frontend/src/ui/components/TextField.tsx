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
  /** A control inside the field on the right, e.g. the password show/hide button. */
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, helper, error, id, className, type = "text", trailing, ...rest },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? `field-${autoId}`;
    const helperId = helper ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy =
      [errorId, helperId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cx("flex flex-col gap-1.5", className)}>
        <label
          className="text-footnote font-medium text-ink-secondary"
          htmlFor={inputId}
        >
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cx(
              "input focus-ring h-[52px] w-full rounded-field border-control bg-surface px-4 text-body text-ink placeholder:text-ink-tertiary aria-invalid:border-error disabled:opacity-40",
              trailing != null && "pr-14",
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
          {trailing != null && (
            <div className="absolute inset-y-0 right-1 flex items-center">
              {trailing}
            </div>
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
