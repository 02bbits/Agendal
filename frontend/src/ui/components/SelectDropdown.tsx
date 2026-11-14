import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { cx } from "./cx";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string;
}

export interface SelectDropdownProps<T extends string> {
  label: string;
  options: ReadonlyArray<SelectOption<T>>;
  value: T;
  onChange: (value: T) => void;
  helperText?: string;
  className?: string;
  roleMode?: "radio" | "option";
}

export function SelectDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  helperText,
  className,
  roleMode = "option",
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedOption =
    options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const next = (currentIndex + 1) % options.length;
        onChange(options[next]!.value);
        optionRefs.current[next]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const prev = (currentIndex - 1 + options.length) % options.length;
        onChange(options[prev]!.value);
        optionRefs.current[prev]?.focus();
      }
    }
  };

  return (
    <div ref={containerRef} className={cx("relative space-y-1.5", className)}>
      <label className="block text-body font-normal text-ink lg:text-callout lg:font-semibold">
        {label}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={onKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cx(
            "focus-ring flex h-10 w-full items-center justify-between rounded-lg border border-separator/60 bg-fill/25 px-3.5 text-callout text-ink transition-colors hover:border-separator hover:bg-fill/40 cursor-pointer",
            isOpen && "border-primary/80 ring-1 ring-primary/40",
          )}
        >
          <span className="flex items-center gap-2.5 truncate">
            {selectedOption?.icon && (
              <span className="shrink-0 text-ink-secondary" aria-hidden="true">
                {selectedOption.icon}
              </span>
            )}
            <span className="truncate">{selectedOption?.label}</span>
          </span>
          <span
            className={cx(
              "shrink-0 text-ink-tertiary transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          >
            <ChevronDownIcon size={16} />
          </span>
        </button>

        {/* Options list */}
        {(roleMode === "radio" || isOpen) && (
          <div
            role={roleMode === "radio" ? "radiogroup" : "listbox"}
            aria-label={label}
            className={cx(
              "z-50 rounded-xl border border-separator/70 bg-surface/95 backdrop-blur-md shadow-2xl p-1 transition-all duration-150 ease-out origin-top max-h-60 overflow-y-auto space-y-0.5",
              roleMode === "radio" && !isOpen
                ? "opacity-0 scale-95 -translate-y-1 pointer-events-none absolute h-0 overflow-hidden"
                : "absolute left-0 right-0 top-full mt-1 opacity-100 scale-100 translate-y-0 pointer-events-auto",
            )}
          >
            {options.map((option, idx) => {
              const isSelected = option.value === value;
              const isDisabled = Boolean(option.disabled);
              return (
                <button
                  key={option.value}
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  type="button"
                  disabled={isDisabled}
                  role={roleMode === "radio" ? "radio" : "option"}
                  aria-checked={roleMode === "radio" ? isSelected : undefined}
                  aria-selected={roleMode === "option" ? isSelected : undefined}
                  aria-disabled={isDisabled ? true : undefined}
                  tabIndex={isOpen && !isDisabled ? 0 : -1}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(option.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={cx(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-callout text-left transition-all duration-150",
                    isDisabled
                      ? "opacity-40 cursor-not-allowed select-none"
                      : isSelected
                        ? "font-semibold text-primary bg-primary/10 cursor-pointer"
                        : "text-ink hover:bg-fill/50 active:bg-fill/70 cursor-pointer",
                  )}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    {option.icon && (
                      <span
                        className="shrink-0 text-ink-secondary"
                        aria-hidden="true"
                      >
                        {option.icon}
                      </span>
                    )}
                    <span>{option.label}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {option.badge && (
                      <span className="text-caption font-normal text-ink-tertiary">
                        {option.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="text-primary" aria-hidden="true">
                        <CheckIcon size={16} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {helperText && (
        <p className="m-0 mt-1 text-footnote text-ink-secondary lg:text-caption lg:text-ink-tertiary">
          {helperText}
        </p>
      )}
    </div>
  );
}
