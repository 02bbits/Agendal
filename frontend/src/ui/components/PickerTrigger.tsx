import type { KeyboardEvent, ReactElement, ReactNode, RefObject } from "react";
import { cx } from "./cx";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";

export interface PickerTriggerProps {
  triggerRef: RefObject<HTMLButtonElement | null>;
  id: string;
  label: string;
  haspopup: "listbox" | "dialog";
  open: boolean;
  controls?: string;
  describedBy?: string;
  disabled: boolean;
  isScreen: boolean;
  onToggle: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  leading?: ReactNode;
  children: ReactNode;
}

/** The pill (panel) or right-aligned row (screen) button that opens a picker. */
export function PickerTrigger({
  triggerRef,
  id,
  label,
  haspopup,
  open,
  controls,
  describedBy,
  disabled,
  isScreen,
  onToggle,
  onKeyDown,
  leading,
  children,
}: PickerTriggerProps): ReactElement {
  return (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      aria-label={label}
      aria-haspopup={haspopup}
      aria-expanded={open}
      aria-controls={controls}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => !disabled && onToggle()}
      onKeyDown={onKeyDown}
      className={cx(
        "focus-ring relative inline-flex cursor-pointer items-center border-0 text-ink focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        isScreen
          ? "justify-end gap-1 bg-transparent py-1 pr-5 text-right text-body text-ink-secondary"
          : "gap-1.5 rounded-full bg-fill py-1 pl-3 pr-6 text-footnote font-medium",
      )}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <span>{children}</span>
      {isScreen ? (
        <ChevronRightIcon
          size={16}
          className="pointer-events-none absolute right-0 text-ink-tertiary"
        />
      ) : (
        <ChevronDownIcon
          size={14}
          className="pointer-events-none absolute right-2 text-ink-secondary"
        />
      )}
    </button>
  );
}
