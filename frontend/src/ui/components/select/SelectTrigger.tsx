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
  onClick,
  onKeyDown,
}: {
  buttonRef: Ref<HTMLButtonElement>;
  open: boolean;
  valueKey: string;
  label?: string;
  icon?: ReactNode;
  reducedMotion: boolean;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-haspopup="listbox"
      aria-expanded={open}
      className={cx(
        "focus-ring flex h-10 w-full items-center justify-between rounded-lg border border-separator/60 bg-fill/25 px-3.5 text-callout text-ink transition-colors hover:border-separator hover:bg-fill/40 cursor-pointer",
        open && "border-primary/80 ring-1 ring-primary/40",
      )}
    >
      <span className="flex items-center gap-2.5 truncate flex-1 min-w-0">
        {icon && (
          <span className="shrink-0 text-ink-secondary" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="relative flex-1 min-w-0 h-5 overflow-hidden">
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
          "shrink-0 text-ink-tertiary transition-transform duration-200 ml-2",
          open && "rotate-180",
        )}
        aria-hidden="true"
      >
        <ChevronDownIcon size={16} />
      </span>
    </button>
  );
}
