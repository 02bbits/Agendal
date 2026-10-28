import { forwardRef, useId, type InputHTMLAttributes } from "react";
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
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, helper, error, id, className, type = "text", ...rest },
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
        <input
          ref={ref}
          id={inputId}
          type={type}
          className="input focus-ring h-[52px] w-full rounded-field border-control bg-surface px-4 text-body text-ink placeholder:text-ink-tertiary aria-invalid:border-error disabled:opacity-40"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
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
