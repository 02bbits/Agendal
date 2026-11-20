import type { ReactElement } from "react";
import { cx } from "./cx";
import { ChevronLeftIcon } from "./icons";

export interface BackButtonProps {
  /** The visible text after the chevron: "Back", or the page it returns to. */
  label: string;
  onClick: () => void;
  /** When the visible text names the page rather than saying "Back". */
  ariaLabel?: string;
  iconSize?: number;
  /** Size, colour and spacing for where it sits. */
  className?: string;
}

/**
 * "‹ Back": a chevron and a label whose underline swipes in on hover and keyboard focus, the
 * same as every other way back in the app.
 */
export function BackButton({
  label,
  onClick,
  ariaLabel,
  iconSize = 18,
  className,
}: BackButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        "focus-ring inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent",
        className,
      )}
    >
      <ChevronLeftIcon size={iconSize} className="shrink-0" />
      <span className="link-swipe">{label}</span>
    </button>
  );
}
