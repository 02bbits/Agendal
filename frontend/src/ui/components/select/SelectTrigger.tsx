import type { KeyboardEvent, ReactNode, Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "../cx";
import { ChevronDownIcon } from "../icons";
import { swapMotion } from "./selectMotion";

const LABEL_MOTION = {
  from: { y: 6, filter: "blur(4px)" },
  to: { y: 0, filter: "blur(0px)" },
  exit: { y: -6, filter: "blur(4px)" },
};

/** The closed select: the chosen option, which rolls over when it changes, and a chevron. */
export function SelectTrigger({
  buttonRef,
  open,
  valueKey,
  label,
  icon,
  reducedMotion,
  size = "md",
  disabled = false,
  onClick,
  onKeyDown,
}: {
  buttonRef: Ref<HTMLButtonElement>;
  open: boolean;
  valueKey: string;
  label?: string;
  icon?: ReactNode;
  reducedMotion: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const isSm = size === "sm";

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : onKeyDown}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-disabled={disabled ? true : undefined}
      className={cx(
        "focus-ring flex w-full items-center justify-between rounded-lg border transition-colors",
        disabled
          ? "border-separator/40 bg-fill/15 text-ink-tertiary cursor-not-allowed opacity-60"
          : "border-separator/60 bg-fill/25 hover:border-separator hover:bg-fill/40 cursor-pointer text-ink",
        isSm ? "h-9 px-2.5 text-footnote" : "h-10 px-3.5 text-callout",
        open && !disabled && "border-primary/80 ring-1 ring-primary/40",
      )}
    >
      <span className="flex items-center gap-2 truncate flex-1 min-w-0">
        {icon && (
          <span className="shrink-0 text-ink-secondary" aria-hidden="true">
            {icon}
          </span>
        )}
        <span
          className={cx(
            "relative flex-1 min-w-0 overflow-hidden",
            isSm ? "h-4.5" : "h-5",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={valueKey}
              {...swapMotion(reducedMotion, LABEL_MOTION, {
                full: 0.4,
                reduced: 0.2,
              })}
              className="absolute inset-0 block truncate text-left"
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
      <span
        className={cx(
          "shrink-0 text-ink-tertiary transition-transform duration-200 ml-1.5",
          open && "rotate-180",
        )}
        aria-hidden="true"
      >
        <ChevronDownIcon size={isSm ? 14 : 16} />
      </span>
    </button>
  );
}
