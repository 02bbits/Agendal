import type { ReactElement, ReactNode } from "react";
import { BackButton } from "./BackButton";
import { cx } from "./cx";

/**
 * The "‹ Back" row at the top of a phone screen: Settings, Task details and Note details all use
 * this one, so the height, hairline, spacing and button look the same everywhere (#168).
 */
export function BackBar({
  label,
  ariaLabel,
  onBack,
  children,
  className,
}: {
  /** "Back", or the page it returns to. */
  label: string;
  ariaLabel?: string;
  onBack: () => void;
  /** A title centred in the row, if any. */
  children?: ReactNode;
  /** Spacing for where it sits: the side padding follows the screen's content. */
  className?: string;
}): ReactElement {
  return (
    <div
      className={cx(
        "relative flex h-11 shrink-0 items-center border-b border-separator px-4",
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
    </div>
  );
}
