import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "./icons";
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
  searchable?: boolean;
  searchPlaceholder?: string;
}

const EASE_SOFT_OUT = [0.215, 0.61, 0.355, 1] as const;

export function SelectDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  helperText,
  className,
  roleMode = "option",
  searchable = false,
  searchPlaceholder,
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isFiltering = searchQuery.trim().length > 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const prefersReducedMotion = Boolean(useReducedMotion());

  const selectedOption =
    options.find((opt) => opt.value === value) ?? options[0];

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return options;
    }
    const q = searchQuery.trim().toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (typeof opt.value === "string" && opt.value.toLowerCase().includes(q)),
    );
  }, [options, searchable, searchQuery]);

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

  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  const onTriggerClick = () => {
    setIsOpen((prev) => {
      if (!prev) {
        setSearchQuery("");
        return true;
      }
      return false;
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      if (!isOpen) {
        e.preventDefault();
        setSearchQuery("");
        setIsOpen(true);
      } else if (!searchable) {
        e.preventDefault();
        const currentIndex = filteredOptions.findIndex(
          (opt) => opt.value === value,
        );
        const next = (currentIndex + 1) % filteredOptions.length;
        onChange(filteredOptions[next]!.value);
        optionRefs.current[next]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      if (!isOpen) {
        e.preventDefault();
        setSearchQuery("");
        setIsOpen(true);
      } else if (!searchable) {
        e.preventDefault();
        const currentIndex = filteredOptions.findIndex(
          (opt) => opt.value === value,
        );
        const prev =
          (currentIndex - 1 + filteredOptions.length) % filteredOptions.length;
        onChange(filteredOptions[prev]!.value);
        optionRefs.current[prev]?.focus();
      }
    }
  };

  const onOptionKeyDown = (e: KeyboardEvent, idx: number) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (idx + 1) % filteredOptions.length;
      optionRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0 && searchable) {
        searchInputRef.current?.focus();
      } else {
        const prev =
          (idx - 1 + filteredOptions.length) % filteredOptions.length;
        optionRefs.current[prev]?.focus();
      }
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const firstEnabledIndex = filteredOptions.findIndex(
        (opt) => !opt.disabled,
      );
      if (firstEnabledIndex !== -1) {
        optionRefs.current[firstEnabledIndex]?.focus();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const firstEnabled = filteredOptions.find((opt) => !opt.disabled);
      if (firstEnabled) {
        onChange(firstEnabled.value);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
  };

  const containerVariants: Variants = {
    closed: {
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.9,
      transition: {
        duration: 0.22,
        ease: EASE_SOFT_OUT,
        staggerChildren: 0,
      },
    },
    open: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.22,
        ease: EASE_SOFT_OUT,
      },
    },
  };

  const listVariants: Variants = {
    closed: {
      transition: {
        staggerChildren: 0,
      },
    },
    open: {
      transition: {
        staggerChildren:
          isFiltering || prefersReducedMotion
            ? 0
            : filteredOptions.length > 10
              ? 0.033 * Math.sqrt(10 / filteredOptions.length)
              : 0.033,
      },
    },
  };

  const itemVariants: Variants = {
    closed: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : 8,
      filter: prefersReducedMotion ? "none" : "blur(4px)",
      transition: {
        duration: 0.1,
      },
    },
    open: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: {
        duration: isFiltering || prefersReducedMotion ? 0 : 0.3,
        ease: EASE_SOFT_OUT,
      },
    },
  };

  return (
    <div ref={containerRef} className={cx("relative space-y-1.5", className)}>
      <label className="block text-callout font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={onTriggerClick}
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

        {/* Options list popup */}
        <motion.div
          key="select-dropdown-popup"
          initial="closed"
          animate={isOpen ? "open" : "closed"}
          variants={containerVariants}
          style={{ transformOrigin: "top" }}
          className={cx(
            "z-50 rounded-xl border border-separator/70 bg-surface/95 backdrop-blur-md shadow-2xl p-1 origin-top max-h-64 overflow-y-auto space-y-0.5 absolute left-0 right-0 top-full mt-1",
            isOpen ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          {searchable && (
            <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md pb-1.5 pt-0.5 px-0.5 border-b border-separator/40 mb-1">
              <div className="flex h-8 items-center gap-2 rounded-lg bg-fill/40 px-2.5 text-callout border border-separator/50 focus-within:border-primary/70 focus-within:ring-1 focus-within:ring-primary/30">
                <span className="shrink-0 text-ink-tertiary" aria-hidden="true">
                  <SearchIcon size={14} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder ?? "Search..."}
                  aria-label={`Search ${label}`}
                  className="w-full bg-transparent border-0 text-footnote text-ink placeholder:text-ink-tertiary outline-none focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="text-ink-tertiary hover:text-ink cursor-pointer p-0.5"
                    aria-label="Clear search"
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <motion.div
            role={roleMode === "radio" ? "radiogroup" : "listbox"}
            aria-label={label}
            variants={listVariants}
            className="space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-footnote text-ink-tertiary m-0">
                No matches found
              </p>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = option.value === value;
                const isDisabled = Boolean(option.disabled);
                return (
                  <motion.button
                    key={option.value}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    disabled={isDisabled}
                    role={roleMode === "radio" ? "radio" : "option"}
                    aria-checked={roleMode === "radio" ? isSelected : undefined}
                    aria-selected={
                      roleMode === "option" ? isSelected : undefined
                    }
                    aria-disabled={isDisabled ? true : undefined}
                    tabIndex={isOpen && !isDisabled ? 0 : -1}
                    variants={itemVariants}
                    onClick={() => {
                      if (isDisabled) return;
                      onChange(option.value);
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                    onKeyDown={(e) => onOptionKeyDown(e, idx)}
                    className={cx(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-callout text-left transition-colors duration-150",
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
                  </motion.button>
                );
              })
            )}
          </motion.div>
        </motion.div>
      </div>
      {helperText && (
        <p className="m-0 text-caption text-ink-tertiary">{helperText}</p>
      )}
    </div>
  );
}
