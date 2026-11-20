import type { KeyboardEvent, ReactNode, Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "../cx";
import { CheckIcon } from "../icons";
import { swapMotion } from "./selectMotion";

const TICK_MOTION = {
  from: { scale: 0.6, filter: "blur(2px)" },
  to: { scale: 1, filter: "blur(0px)" },
  exit: { scale: 0.6, filter: "blur(2px)" },
};

/** One choice in the list: its icon and label, an optional badge, and a tick when chosen. */
export function SelectOptionRow({
  buttonRef,
  label,
  icon,
  badge,
  selected,
  hovered,
  disabled,
  radio,
  open,
  reducedMotion,
  onHover,
  onSelect,
  onKeyDown,
}: {
  buttonRef: Ref<HTMLButtonElement>;
  label: string;
  icon?: ReactNode;
  badge?: string;
  selected: boolean;
  hovered: boolean;
  disabled: boolean;
  /** Radios for a few settled choices, options for a list. */
  radio: boolean;
  open: boolean;
  reducedMotion: boolean;
  onHover: () => void;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      role={radio ? "radio" : "option"}
      aria-checked={radio ? selected : undefined}
      aria-selected={radio ? undefined : selected}
      aria-disabled={disabled ? true : undefined}
      tabIndex={open && !disabled ? 0 : -1}
      onMouseMove={() => {
        if (!disabled && !hovered) onHover();
      }}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={onKeyDown}
      className={cx(
        "relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-callout text-left outline-none transition-colors duration-150 z-0",
        disabled
          ? "opacity-40 cursor-not-allowed select-none"
          : selected
            ? "font-semibold text-primary bg-primary/10 hover:bg-primary/15 cursor-pointer"
            : hovered
              ? "text-ink bg-fill/50 cursor-pointer"
              : "text-ink hover:bg-fill/50 active:bg-fill/70 cursor-pointer",
      )}
    >
      <span className="flex items-center gap-2.5 truncate relative z-10">
        {icon && (
          <span className="shrink-0 text-ink-secondary" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{label}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0 relative z-10 min-w-4 justify-end">
        {badge && (
          <span className="text-caption font-normal text-ink-tertiary">
            {badge}
          </span>
        )}
        <AnimatePresence>
          {selected && (
            <motion.span
              key="check-icon"
              {...swapMotion(reducedMotion, TICK_MOTION, {
                full: 0.25,
                reduced: 0.15,
              })}
              className="text-primary shrink-0 flex items-center"
              aria-hidden="true"
            >
              <CheckIcon size={16} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}
