import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { addDays, startOfWeek } from "../domain/dates";
import type { WeekStart } from "../domain/types";
import { shiftMonth } from "./calendar";

export interface UseDatePickerKeyboardOptions {
  value?: string | null;
  todayDate: string;
  weekStart: WeekStart;
  onChange: (date: string) => void;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useDatePickerKeyboard({
  value,
  todayDate,
  weekStart,
  onChange,
  disabled = false,
  onOpenChange,
}: UseDatePickerKeyboardOptions) {
  const [open, setOpen] = useState(false);
  const initialDate = value || todayDate;
  const [viewMonth, setViewMonth] = useState(`${initialDate.slice(0, 7)}-01`);
  const [focusedDate, setFocusedDate] = useState(initialDate);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const changeOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const closeAndFocus = useCallback(() => {
    changeOpen(false);
    triggerRef.current?.focus();
  }, [changeOpen]);

  const selectAndClose = useCallback(
    (date: string) => {
      onChange(date);
      closeAndFocus();
    },
    [onChange, closeAndFocus],
  );

  useEffect(() => {
    if (open) {
      const active = value || todayDate;
      const frame = requestAnimationFrame(() => {
        setFocusedDate(active);
        setViewMonth(`${active.slice(0, 7)}-01`);
        dayRefs.current.get(active)?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [open, value, todayDate]);

  const moveFocus = (targetDate: string) => {
    setFocusedDate(targetDate);
    const targetMonth = `${targetDate.slice(0, 7)}-01`;
    if (targetMonth !== viewMonth) {
      setViewMonth(targetMonth);
    }
    requestAnimationFrame(() => {
      dayRefs.current.get(targetDate)?.focus();
    });
  };

  const onDayKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveFocus(addDays(date, -1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveFocus(addDays(date, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(addDays(date, -7));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(addDays(date, 7));
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(startOfWeek(date, weekStart));
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(addDays(startOfWeek(date, weekStart), 6));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      moveFocus(shiftMonth(date, -1));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      moveFocus(shiftMonth(date, 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectAndClose(date);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeAndFocus();
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!disabled && ["ArrowDown", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      changeOpen(true);
    }
  };

  return {
    open,
    setOpen: changeOpen,
    viewMonth,
    setViewMonth,
    focusedDate,
    triggerRef,
    dayRefs,
    closeAndFocus,
    selectAndClose,
    onDayKeyDown,
    onTriggerKeyDown,
  };
}
