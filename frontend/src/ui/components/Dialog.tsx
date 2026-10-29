import { useId, useRef, type ReactNode } from "react";
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
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  actions,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModalFocus(dialogRef, titleRef, open, onClose);

  if (!open) return null;

  return (
    <div className="modal modal-open bg-scrim px-5">
      <div
        ref={dialogRef}
        className="modal-box flex w-full max-w-[360px] flex-col gap-2 rounded-dialog bg-surface-elevated p-5 text-ink shadow-lg motion-reduce:transition-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <h2
          ref={titleRef}
          id={titleId}
          className="m-0 font-serif text-dialog font-semibold text-balance focus:outline-none"
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
    </div>
  );
}
