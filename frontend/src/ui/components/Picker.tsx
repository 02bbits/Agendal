import { useId, type ReactElement } from "react";
import { cx } from "./cx";
import { CheckIcon } from "./icons";
import { PickerTrigger } from "./PickerTrigger";
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
  ariaDescribedBy,
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
        popoverClassName="max-h-[min(320px,calc(100vh-16px))]"
        trigger={
          <PickerTrigger
            triggerRef={triggerRef}
            id={pickerId}
            label={label}
            haspopup="listbox"
            open={open}
            controls={listboxId}
            describedBy={ariaDescribedBy ?? helperId}
            disabled={disabled}
            isScreen={isScreen}
            onToggle={() => setOpen((o) => !o)}
            onKeyDown={onTriggerKeyDown}
            leading={selectedOption?.leading}
          >
            {selectedOption ? selectedOption.label : value}
          </PickerTrigger>
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
