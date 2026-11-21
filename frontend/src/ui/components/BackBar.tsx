import type { ReactElement, ReactNode } from "react";
import { BackButton } from "./BackButton";
import { cx } from "./cx";

/**
 * The "‹ Back" row at the top of a phone screen: Settings, Task details, Note details and a
 * project's page all use this one, so the height, hairline, spacing and button look the same
 * everywhere (#168). It keeps clear of the notch or punch-hole camera, and the Back text sits as
 * far above the hairline as below the top of the screen.
 */
export function BackBar({
  label,
  ariaLabel,
  onBack,
  actions,
  children,
  className,
}: {
  /** "Back", or the page it returns to. */
  label: string;
  ariaLabel?: string;
  onBack: () => void;
  /** Buttons at the right end of the row, e.g. a project's ⋯ menu. */
  actions?: ReactNode;
  /** A title centred in the row, if any. */
  children?: ReactNode;
  /** Spacing for where it sits: the side padding follows the screen's content. */
  className?: string;
}): ReactElement {
  return (
    <div
      className={cx(
        "relative box-content flex h-11 shrink-0 items-center border-b border-separator px-4 pb-2 pt-[max(0.5rem,calc(env(safe-area-inset-top,0px)+0.5rem))]",
        className,
      )}
    >
      <BackButton
        label={label}
        ariaLabel={ariaLabel}
        onClick={onBack}
        className="z-10 h-11 text-callout font-medium text-primary"
      />
      {children}
      {actions && (
        <div className="relative z-10 ml-auto flex items-center gap-1">
          {actions}
        </div>
      )}
    </div>
  );
}
