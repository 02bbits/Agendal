import type { ReactElement, ReactNode } from "react";
import { cx } from "../../components/cx";

/** The small uppercase heading over a group of settings. */
export function SettingsHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <h2
      className={cx(
        "text-overline uppercase font-semibold text-ink-secondary",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/**
 * One tab's settings. Account, General and Theme stay mounted while another tab shows, so a
 * name being typed survives a tab switch: on desktop they are faded out of the way, on a phone
 * hidden.
 */
export function SettingsPanel({
  active,
  isDesktop,
  children,
}: {
  active: boolean;
  isDesktop: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      className={cx(
        "space-y-6 max-w-[620px]",
        active
          ? "opacity-100"
          : isDesktop
            ? "opacity-0 pointer-events-none absolute h-0 overflow-hidden"
            : "hidden",
      )}
    >
      {children}
    </div>
  );
}
