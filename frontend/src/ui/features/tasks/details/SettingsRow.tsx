import type { ReactElement, ReactNode } from "react";
import { cx } from "../../../components/cx";
import { LayeredIcon } from "../../../components/LayeredIcon";

export interface SettingsRowProps {
  variant?: "panel" | "screen";
  icon: ReactNode;
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
  label,
  control,
  extraAction,
  helper,
  error,
  errorId,
  helperId,
}: SettingsRowProps): ReactElement {
  const isScreen = variant === "screen";

  const messages = (
    <>
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
    </>
  );

  // The helper or error sits under the label, so the control stays centred on the whole row.
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-3",
        isScreen
          ? "py-3.5 px-4"
          : "border-b border-separator py-2.5 last:border-b-0",
      )}
    >
      {isScreen ? (
        <>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center text-ink">
                <LayeredIcon>{icon}</LayeredIcon>
              </div>
              <span className="text-body font-normal text-ink">{label}</span>
            </div>
            {messages}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {control}
            {extraAction}
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 text-body text-ink">
              <span className="flex items-center justify-center text-ink-tertiary">
                {icon}
              </span>
              <span>{label}</span>
            </div>
            {messages}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {control}
            {extraAction}
          </div>
        </>
      )}
    </div>
  );
}
