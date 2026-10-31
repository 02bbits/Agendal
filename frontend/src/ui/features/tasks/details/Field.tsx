import type { ReactElement, ReactNode } from "react";

export { CONTROL_CLASS, FIELD_CONTROL_CLASS } from "./control";

export interface FieldProps {
  id?: string;
  label: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  errorId?: string;
  helperId?: string;
  children: ReactNode;
}

export function Field({
  id,
  label,
  helper,
  error,
  errorId,
  helperId,
  children,
}: FieldProps): ReactElement {
  const errId = errorId ?? (id ? `${id}-error` : undefined);
  const helpId = helperId ?? (id ? `${id}-helper` : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-footnote font-medium text-ink-secondary"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={errId} role="alert" className="m-0 text-footnote text-error">
          {error}
        </p>
      ) : helper ? (
        <p id={helpId} className="m-0 text-footnote text-ink-secondary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
