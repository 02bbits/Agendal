import {
  createContext,
  useContext,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { XIcon } from "./icons";
import { useHistoryEntry } from "./useHistoryEntry";
import { useModalFocus } from "./useModalFocus";

/** A sheet opened from another sheet stays inside it, in the parent's focus trap. */
const InsideSheet = createContext(false);

export interface SheetProps {
  open: boolean;
  title: string;
  /** Called by ×, Escape and a tap on the scrim. The caller asks "Discard changes?" when there are edits (UX-13). */
  onClose: () => void;
  /** Accessible name of the × button, from the copy catalog. */
  closeLabel: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  children?: ReactNode;
}

export function Sheet({
  open,
  title,
  onClose,
  closeLabel,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  children,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const nested = useContext(InsideSheet);
  useModalFocus(sheetRef, titleRef, open, onClose);
  useHistoryEntry(open, onClose);

  if (!open || typeof document === "undefined") return null;

  const onScrimClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const sheet = (
    <div
      className="modal modal-open modal-bottom bg-scrim md:modal-middle"
      onMouseDown={onScrimClick}
    >
      <div
        ref={sheetRef}
        className="modal-box mx-auto mb-[var(--keyboard-inset,0px)] max-h-[calc(100dvh-32px-var(--keyboard-inset,0px))] w-full max-w-[600px] rounded-t-sheet rounded-b-none bg-surface px-gutter pt-2 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-lg md:mb-0 md:max-w-[560px] md:rounded-dialog md:pb-5 motion-reduce:transition-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="grid min-h-14 grid-cols-[44px_1fr_auto] items-center gap-2">
          <IconButton
            plain
            label={closeLabel}
            icon={<XIcon />}
            onClick={onClose}
          />
          <h2
            ref={titleRef}
            id={titleId}
            className="m-0 text-center text-heading font-semibold focus:outline-none"
            tabIndex={-1}
          >
            {title}
          </h2>
          {confirmLabel && onConfirm ? (
            <button
              type="button"
              className="focus-ring min-h-11 cursor-pointer rounded-field border-0 bg-transparent px-2 text-heading font-semibold text-primary enabled:hover:bg-fill disabled:opacity-40"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          ) : (
            <span />
          )}
        </div>
        <InsideSheet.Provider value={true}>{children}</InsideSheet.Provider>
      </div>
    </div>
  );

  // In body: a parent with its own stacking (the sticky week bar) would keep it under the tab bar
  return nested ? sheet : createPortal(sheet, document.body);
}
