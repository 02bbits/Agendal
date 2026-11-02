import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface PickerOption<V extends string> {
  value: V;
  label: string;
  leading?: ReactNode;
}

export type PickerVariant = "panel" | "screen" | "pill" | "row";

export interface PickerProps<V extends string> {
  label: string;
  value: V;
  options: ReadonlyArray<PickerOption<V>>;
  onChange: (value: V) => void;
  variant?: PickerVariant;
  disabled?: boolean;
  helper?: ReactNode;
  id?: string;
  className?: string;
}

export function findTypeaheadMatch<V extends string>(
  options: ReadonlyArray<PickerOption<V>>,
  query: string,
  start = 0,
): number {
  if (!query || options.length === 0) return -1;
  const q = query.toLowerCase();
  for (let i = 0; i < options.length; i++) {
    const idx = (start + i) % options.length;
    if (options[idx]?.label.toLowerCase().startsWith(q)) return idx;
  }
  return -1;
}

export interface UsePickerKeyboardOptions<V extends string> {
  options: ReadonlyArray<PickerOption<V>>;
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
}

export function usePickerKeyboard<V extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: UsePickerKeyboardOptions<V>) {
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [focusedIndex, setFocusedIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : 0,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadBuf = useRef("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeAndFocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    const target = idx >= 0 ? idx : 0;
    const frame = requestAnimationFrame(() => {
      setFocusedIndex(target);
      optionRefs.current[target]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, value, options]);

  const onOptionKeyDown = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(i + 1, options.length - 1);
      setFocusedIndex(next);
      optionRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(i - 1, 0);
      setFocusedIndex(prev);
      optionRefs.current[prev]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const target = e.key === "Home" ? 0 : options.length - 1;
      setFocusedIndex(target);
      optionRefs.current[target]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(options[i]!.value);
      closeAndFocus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      if (e.key === "Escape") e.stopPropagation();
      closeAndFocus();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
      typeaheadBuf.current += e.key;
      typeaheadTimer.current = setTimeout(
        () => (typeaheadBuf.current = ""),
        500,
      );
      const match = findTypeaheadMatch(
        options,
        typeaheadBuf.current,
        typeaheadBuf.current.length === 1 ? i + 1 : i,
      );
      if (match >= 0) {
        setFocusedIndex(match);
        optionRefs.current[match]?.focus();
      }
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!disabled && ["ArrowDown", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return {
    open,
    setOpen,
    focusedIndex,
    triggerRef,
    optionRefs,
    closeAndFocus,
    onOptionKeyDown,
    onTriggerKeyDown,
  };
}
