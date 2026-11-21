import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { searchOptionId } from "./SearchSection";

/** True while typing in a field other than the search box: its keys are its own. */
function typingElsewhere(search: HTMLInputElement | null) {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active === search) return false;
  return (
    active.tagName === "INPUT" ||
    active.tagName === "TEXTAREA" ||
    active.isContentEditable
  );
}

/** A picker's list is open: its arrows are its own. */
const pickerOpen = () =>
  document.querySelector('[id*="picker"][role="listbox"]') !== null;

/** A plain letter, digit or symbol, not a shortcut. */
const isCharacter = (e: globalThis.KeyboardEvent) =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/**
 * The keyboard in search: Up and Down move through the results, wrapping round, and Enter opens
 * the current one, or searches now when none is current. The arrows work without clicking the
 * box first, and typing anywhere goes into it.
 */
export function useSearchKeyboard<Row>({
  rows,
  inputRef,
  canOpen,
  open,
  searchNow,
}: {
  rows: Row[];
  inputRef: RefObject<HTMLInputElement | null>;
  /** False while results are on their way: Enter searches instead. */
  canOpen: boolean;
  open: (row: Row) => void;
  searchNow: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);

  // New results or another tab: nothing is current
  const [shownRows, setShownRows] = useState(rows);
  if (rows !== shownRows) {
    setShownRows(rows);
    setActiveIndex(-1);
  }

  const moveTo = useCallback((index: number) => {
    setActiveIndex(index);
    document
      .getElementById(searchOptionId(index))
      ?.scrollIntoView?.({ block: "nearest" });
  }, []);

  const next = useCallback(() => {
    moveTo(activeIndex < 0 ? 0 : (activeIndex + 1) % rows.length);
  }, [activeIndex, rows.length, moveTo]);

  const previous = useCallback(() => {
    moveTo(activeIndex <= 0 ? rows.length - 1 : activeIndex - 1);
  }, [activeIndex, rows.length, moveTo]);

  const activate = useCallback(() => {
    const row = rows[activeIndex];
    if (canOpen && row) open(row);
    else searchNow();
  }, [rows, activeIndex, canOpen, open, searchNow]);

  /** Up and Down move, Enter opens; `enterOnlyWhenCurrent` for keys from outside the box. */
  const handleKey = useCallback(
    (
      e: { key: string; preventDefault: () => void },
      enterOnlyWhenCurrent: boolean,
    ) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (rows.length === 0) return;
        e.preventDefault();
        if (e.key === "ArrowDown") next();
        else previous();
      } else if (e.key === "Enter") {
        if (enterOnlyWhenCurrent && activeIndex < 0) return;
        e.preventDefault();
        activate();
      }
    },
    [rows.length, next, previous, activate, activeIndex],
  );

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const search = inputRef.current;
      if (typingElsewhere(search) || pickerOpen()) return;
      if (isCharacter(e)) {
        if (document.activeElement !== search) search?.focus();
        return;
      }
      handleKey(e, true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey, inputRef]);

  const activeOptionId =
    activeIndex >= 0 && activeIndex < rows.length
      ? searchOptionId(activeIndex)
      : undefined;

  return {
    activeIndex,
    activeOptionId,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => handleKey(e, false),
  };
}
