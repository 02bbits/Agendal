import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { cx } from "./cx";
import { SearchIcon, XIcon } from "./icons";
import { SelectOptionRow } from "./select/SelectOptionRow";
import { SelectTrigger } from "./select/SelectTrigger";

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
  className?: string;
  roleMode?: "radio" | "option";
  searchable?: boolean;
  searchPlaceholder?: string;
  hideLabel?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
}

/** The tick shows on the new choice this long before the list closes. */
const CLOSE_AFTER_PICK_MS = 200;
/** The search box takes focus once the list is on screen. */
const SEARCH_FOCUS_DELAY_MS = 30;

/** Arrow keys step through the list, wrapping round. */
const wrapIndex = (index: number, length: number) => (index + length) % length;

/**
 * A labelled select with its own list (Settings): opens on a click or the arrow keys, closes on
 * Esc or a click outside. With `searchable` a box filters the options as you type.
 */
export function SelectDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  roleMode = "option",
  searchable = false,
  searchPlaceholder,
  hideLabel = false,
  size = "md",
  disabled = false,
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredValue, setHoveredValue] = useState<T | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = Boolean(useReducedMotion());

  const selectedOption =
    options.find((opt) => opt.value === value) ?? options[0];
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!searchable || !query) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query),
    );
  }, [options, searchable, searchQuery]);

  const stopHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  };

  useEffect(() => stopHold, []);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      stopHold();
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !searchable) return;
    const timer = setTimeout(
      () => searchInputRef.current?.focus(),
      SEARCH_FOCUS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [isOpen, searchable]);

  const openList = () => {
    if (disabled) return;
    setSearchQuery("");
    setHoveredValue(value);
    setIsOpen(true);
  };

  const closeList = () => {
    stopHold();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
    setHoveredValue(filteredOptions[index]!.value);
    optionRefs.current[index]?.focus();
  };

  const select = (next: T) => {
    if (next === value) {
      closeList();
      return;
    }
    onChange(next);
    stopHold();
    holdTimerRef.current = setTimeout(closeList, CLOSE_AFTER_PICK_MS);
  };

  // On the closed select: open. Open without a search box: step the choice itself
  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return closeList();
    const step =
      e.key === "ArrowDown" || e.key === "Enter" || e.key === " "
        ? 1
        : e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    if (!isOpen) {
      e.preventDefault();
      openList();
    } else if (!searchable) {
      e.preventDefault();
      const current = filteredOptions.findIndex((opt) => opt.value === value);
      const next = wrapIndex(current + step, filteredOptions.length);
      onChange(filteredOptions[next]!.value);
      focusOption(next);
    }
  };

  const onOptionKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeList();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOption(wrapIndex(index + 1, filteredOptions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index === 0 && searchable) searchInputRef.current?.focus();
      else focusOption(wrapIndex(index - 1, filteredOptions.length));
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const firstEnabled = filteredOptions.findIndex((opt) => !opt.disabled);
    if (e.key === "Escape") {
      e.preventDefault();
      closeList();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (firstEnabled !== -1) focusOption(firstEnabled);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (firstEnabled !== -1) select(filteredOptions[firstEnabled]!.value);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cx("relative", !hideLabel && "space-y-1.5", className)}
    >
      <label
        className={cx(
          hideLabel
            ? "sr-only"
            : "block text-body font-normal text-ink lg:text-callout lg:font-semibold",
        )}
      >
        {label}
      </label>
      <div className="relative">
        <SelectTrigger
          buttonRef={triggerRef}
          open={isOpen}
          valueKey={selectedOption?.value ?? value}
          label={selectedOption?.label}
          icon={selectedOption?.icon}
          reducedMotion={reducedMotion}
          size={size}
          disabled={disabled}
          onClick={() => (isOpen ? setIsOpen(false) : openList())}
          onKeyDown={onTriggerKeyDown}
        />

        {/* Options list popup: opens and closes at once, no drop-in motion */}
        <div
          className={cx(
            "z-50 rounded-xl border border-separator/70 bg-surface/95 backdrop-blur-md shadow-2xl p-1 max-h-64 overflow-y-auto space-y-0.5 absolute left-0 right-0 top-full mt-1",
            !isOpen && "hidden",
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
                  onChange={(e) => setSearchQuery(e.target.value)}
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

          <div
            role={roleMode === "radio" ? "radiogroup" : "listbox"}
            aria-label={label}
            onMouseLeave={() => setHoveredValue(null)}
            className="space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-footnote text-ink-tertiary m-0">
                No matches found
              </p>
            ) : (
              filteredOptions.map((option, index) => (
                <SelectOptionRow
                  key={option.value}
                  buttonRef={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  label={option.label}
                  icon={option.icon}
                  badge={option.badge}
                  selected={option.value === value}
                  hovered={hoveredValue === option.value && !option.disabled}
                  disabled={Boolean(option.disabled)}
                  radio={roleMode === "radio"}
                  open={isOpen}
                  reducedMotion={reducedMotion}
                  onHover={() => setHoveredValue(option.value)}
                  onSelect={() => select(option.value)}
                  onKeyDown={(e) => onOptionKeyDown(e, index)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
