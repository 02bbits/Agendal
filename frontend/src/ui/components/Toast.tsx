import { useCallback, useEffect, useRef, useState } from "react";

export const TOAST_DURATION_MS = 5000;

export interface ToastData {
  /** A new id replaces the current toast (one toast at a time, UX-04). */
  id: string | number;
  message: string;
  /** Usually Undo or Retry, from the copy catalog. */
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastProps {
  toast: ToastData | null;
  onDismiss: (id: ToastData["id"]) => void;
  /** Errors that block an action are assertive; everything else is polite (UX-60). */
  assertive?: boolean;
  duration?: number;
}

/**
 * Always-mounted live region with at most one toast. Shows for 5 s; hover, focus
 * or touch pauses the timer, which restarts when it leaves (UX-04, WCAG 2.2.1).
 */
export function Toast({
  toast,
  onDismiss,
  assertive = false,
  duration = TOAST_DURATION_MS,
}: ToastProps) {
  const [pausedId, setPausedId] = useState<ToastData["id"] | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const toastId = toast?.id;
  // Pausing belongs to one toast: a new toast starts unpaused
  const paused = pausedId !== null && pausedId === toastId;
  const setPaused = useCallback(
    (value: boolean) =>
      setPausedId(value && toastId !== undefined ? toastId : null),
    [toastId],
  );

  useEffect(() => {
    if (toastId === undefined || paused) return;
    const timer = setTimeout(() => onDismiss(toastId), duration);
    return () => clearTimeout(timer);
  }, [toastId, paused, duration, onDismiss]);

  const pause = useCallback(() => setPaused(true), [setPaused]);
  const resume = useCallback(() => {
    if (!regionRef.current?.contains(document.activeElement)) setPaused(false);
  }, [setPaused]);

  const runAction = () => {
    if (!toast) return;
    toast.onAction?.();
    onDismiss(toast.id);
  };

  return (
    <div
      ref={regionRef}
      className="toast toast-bottom toast-center pointer-events-none z-[110] w-full max-w-[600px] px-5"
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {toast && (
        <div
          className="alert pointer-events-auto flex min-h-11 w-full items-center gap-3 rounded-field border-0 bg-neutral py-2 pr-2 pl-4 text-callout text-neutral-content shadow-md motion-safe:animate-slide-up motion-reduce:animate-fade-quick"
          onMouseEnter={pause}
          onMouseLeave={resume}
          onTouchStart={pause}
          onFocus={pause}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setPaused(false);
          }}
        >
          <span className="flex-1 [overflow-wrap:anywhere]">
            {toast.message}
          </span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              className="focus-ring min-h-11 cursor-pointer rounded-field border-0 bg-transparent px-3 text-callout font-semibold text-neutral-content underline underline-offset-[3px]"
              onClick={runAction}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
