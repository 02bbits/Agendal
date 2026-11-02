import type { ReactElement, ReactNode } from "react";
import { cx } from "../../../components/cx";

export interface SettingsRowProps {
  variant?: "panel" | "screen";
  icon: ReactNode;
  tileBg?: string;
  label: string;
  control: ReactNode;
  extraAction?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  errorId?: string;
  helperId?: string;
}

export function SettingsRow({
  variant = "panel",
  icon,
  tileBg,
  label,
  control,
  extraAction,
  helper,
  error,
  errorId,
  helperId,
}: SettingsRowProps): ReactElement {
  const isScreen = variant === "screen";

  if (isScreen) {
    return (
      <div className="flex flex-col py-3.5 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cx(
                "flex size-7 shrink-0 items-center justify-center rounded-tile",
                tileBg ?? "bg-fill text-ink-secondary",
              )}
            >
              {icon}
            </div>
            <span className="text-body font-normal text-ink">{label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {control}
            {extraAction}
          </div>
        </div>
        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-footnote text-error"
          >
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={helperId} className="mt-1 text-footnote text-ink-secondary">
            {helper}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col border-b border-separator py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-body text-ink">
          <span className="flex items-center justify-center text-ink-tertiary">
            {icon}
          </span>
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {control}
          {extraAction}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-footnote text-error">
          {error}
        </p>
      )}
      {helper && !error && (
        <p id={helperId} className="mt-1 text-footnote text-ink-secondary">
          {helper}
        </p>
      )}
    </div>
  );
}
