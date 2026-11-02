import { useId, type ReactElement } from "react";
import { cx } from "./cx";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "./icons";
import { PopoverOrSheet } from "./PopoverOrSheet";
import {
  usePickerKeyboard,
  type PickerOption,
  type PickerProps,
  type PickerVariant,
} from "./usePickerKeyboard";

export type { PickerOption, PickerProps, PickerVariant };

export function Picker<V extends string>({
  label,
  value,
  options,
  onChange,
  variant = "panel",
  disabled = false,
  helper,
  id,
  className,
}: PickerProps<V>): ReactElement {
  const autoId = useId();
  const pickerId = id ?? `picker-${autoId}`;
  const listboxId = `${pickerId}-listbox`;
  const helperId = helper ? `${pickerId}-helper` : undefined;

  const {
    open,
    setOpen,
    focusedIndex,
    triggerRef,
    optionRefs,
    closeAndFocus,
    onOptionKeyDown,
    onTriggerKeyDown,
  } = usePickerKeyboard({ options, value, onChange, disabled });

  const isScreen = variant === "screen" || variant === "row";
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={cx("inline-flex flex-col", className)}>
      <PopoverOrSheet
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        triggerRef={triggerRef}
        align={isScreen ? "right" : "left"}
        trigger={
          <button
            ref={triggerRef}
            id={pickerId}
            type="button"
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-describedby={helperId}
            disabled={disabled}
            onClick={() => !disabled && setOpen((o) => !o)}
            onKeyDown={onTriggerKeyDown}
            className={cx(
              "focus-ring cursor-pointer border-0 text-ink focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
              isScreen
                ? "relative inline-flex items-center justify-end gap-1 bg-transparent py-1 pr-5 text-right text-body text-ink-secondary"
                : "relative inline-flex items-center gap-1.5 rounded-full bg-fill py-1 pl-3 pr-6 text-footnote font-medium",
            )}
          >
            {selectedOption?.leading && (
              <span className="shrink-0">{selectedOption.leading}</span>
            )}
            <span className={cx(isScreen && "text-ink-secondary")}>
              {selectedOption ? selectedOption.label : value}
            </span>
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
        }
      >
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="flex flex-col gap-0.5 p-1"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                id={`${pickerId}-opt-${option.value}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={focusedIndex === index ? 0 : -1}
                className="focus-ring flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-field px-3 py-2 text-body text-ink transition-colors hover:bg-fill active:bg-fill focus:bg-fill focus:outline-none"
                onClick={() => {
                  onChange(option.value);
                  closeAndFocus();
                }}
                onKeyDown={(e) => onOptionKeyDown(e, index)}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {option.leading && (
                    <span className="shrink-0">{option.leading}</span>
                  )}
                  <span className="truncate">{option.label}</span>
                </div>
                {isSelected && (
                  <span className="shrink-0 text-primary">
                    <CheckIcon size={18} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </PopoverOrSheet>
      {helper && (
        <p id={helperId} className="mt-1 text-footnote text-ink-secondary">
          {helper}
        </p>
      )}
    </div>
  );
}
