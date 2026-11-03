import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useHistoryEntry } from "./useHistoryEntry";
import { useModalFocus } from "./useModalFocus";

export interface DialogProps {
  open: boolean;
  /** A question naming the item, e.g. Delete “Portfolio”? */
  title: string;
  /** One line of consequence. */
  description?: string;
  onClose: () => void;
  /** Stacked buttons; the safe exit (Cancel) goes last and destructive buttons are never the default. */
  actions: ReactNode;
  children?: ReactNode;
  /** Takes a history entry so Back closes it. Off when the dialog sits over a screen that has its own entry. */
  history?: boolean;
  /** Initial element to focus on open, e.g. Cancel button (A11Y-42). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  actions,
  children,
  history = true,
  initialFocusRef,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModalFocus(dialogRef, titleRef, open, onClose, initialFocusRef);
  useHistoryEntry(open && history, onClose);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-gutter backdrop-blur-[1px]">
      <div
        ref={dialogRef}
        className="flex w-full max-w-[360px] flex-col gap-2 rounded-dialog bg-surface-elevated p-5 text-ink shadow-2xl motion-reduce:transition-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <h2
          ref={titleRef}
          id={titleId}
          className="m-0 text-dialog font-semibold text-balance focus:outline-none"
          tabIndex={-1}
        >
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="m-0 text-callout text-ink-secondary">
            {description}
          </p>
        )}
        {children}
        <div className="mt-3 flex flex-col gap-2">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
