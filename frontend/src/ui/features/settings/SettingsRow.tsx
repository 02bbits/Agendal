import type { ComponentType, ReactElement, ReactNode } from "react";
import { cx } from "../../components/cx";
import { ChevronRightIcon } from "../../components/icons";

/** The press and hover wash of every Settings row and card. */
export const ROW_PRESS = "active:bg-fill hover:bg-fill/60 cursor-pointer";

/**
 * One tappable row in a Settings card: an icon on a rounded tile, the label, a chevron. Rows
 * after the first get a hairline above, starting at the label like iOS lists. The chevron says
 * the row opens a page; an action (Install app) goes without it.
 */
export function SettingsRow({
  Icon,
  label,
  onClick,
  first = true,
  opensPage = true,
}: {
  Icon: ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  first?: boolean;
  opensPage?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "focus-ring flex min-h-[52px] w-full items-center gap-3 pl-4 pr-3 text-left",
        ROW_PRESS,
      )}
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-fill text-ink">
        <Icon size={18} />
      </span>
      <span
        className={cx(
          "flex flex-1 min-w-0 items-center gap-3 self-stretch",
          !first && "border-t border-separator",
        )}
      >
        <span className="flex-1 truncate text-body text-ink">{label}</span>
        {opensPage && (
          <ChevronRightIcon size={18} className="text-ink-tertiary shrink-0" />
        )}
      </span>
    </button>
  );
}

/** A rounded card holding Settings rows. */
export function SettingsCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-box border border-separator bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}
