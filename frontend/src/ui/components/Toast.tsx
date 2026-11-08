import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "../copy";
import { XIcon } from "./icons";

export const TOAST_DURATION_MS = 5000;

export interface ToastData {
  /** A new id replaces the current toast (one toast at a time, UX-04). */
  id: string | number;
  message: string;
  /** Leading icon, e.g. a check for "Completed …". Decorative. */
  icon?: ReactNode;
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

interface ToastAlertProps {
  toast: ToastData;
  duration: number;
  onDismiss: (id: ToastData["id"]) => void;
  regionRef: React.RefObject<HTMLDivElement | null>;
}

function ToastAlert({
  toast,
  duration,
  onDismiss,
  regionRef,
}: ToastAlertProps) {
  const [paused, setPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const dragStartRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, paused, duration, onDismiss]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    if (!regionRef.current?.contains(document.activeElement)) setPaused(false);
  }, [regionRef]);

  // A press on Undo/Retry is a tap, not a drag: capturing it would send the click to the toast, not the button
  const onAction = (e: React.SyntheticEvent) =>
    (e.target as Element).closest?.("button") !== null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (onAction(e)) return;
    pause();
    dragStartRef.current = e.touches[0].clientX;
    dragOffsetRef.current = 0;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || dragStartRef.current === null) return;
    const diff = e.touches[0].clientX - dragStartRef.current;
    dragOffsetRef.current = diff;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const finalOffset = dragOffsetRef.current;
    if (Math.abs(finalOffset) > 70) {
      onDismiss(toast.id);
    } else {
      dragOffsetRef.current = 0;
      setDragOffset(0);
      resume();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.button !== undefined && e.button !== 0) || onAction(e)) return;
    pause();
    dragStartRef.current = e.clientX ?? 0;
    dragOffsetRef.current = 0;
    isDraggingRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored in test environments
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || dragStartRef.current === null) return;
    const clientX = e.clientX ?? 0;
    const diff = clientX - dragStartRef.current;
    dragOffsetRef.current = diff;
    setDragOffset(diff);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignored if capture already lost
    }
    const finalOffset = dragOffsetRef.current;
    if (Math.abs(finalOffset) > 70) {
      onDismiss(toast.id);
    } else {
      dragOffsetRef.current = 0;
      setDragOffset(0);
      resume();
    }
  };

  const runAction = () => {
    toast.onAction?.();
    onDismiss(toast.id);
  };

  return (
    <div
      className="alert pointer-events-auto flex min-h-11 w-fit max-w-full cursor-grab active:cursor-grabbing touch-pan-y select-none items-center gap-3 rounded-field border-0 bg-neutral py-2 pr-2 pl-4 text-callout text-neutral-content shadow-md motion-safe:animate-slide-in-left motion-reduce:animate-fade-quick"
      style={{
        transform: dragOffset ? `translateX(${dragOffset}px)` : undefined,
        opacity: dragOffset
          ? Math.max(0.2, 1 - Math.abs(dragOffset) / 200)
          : undefined,
        transition: dragOffset
          ? "none"
          : "transform 200ms ease-out, opacity 200ms ease-out",
      }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onFocus={pause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setPaused(false);
      }}
    >
      {toast.icon && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {toast.icon}
        </span>
      )}
      <span className="min-w-0 [overflow-wrap:anywhere]">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          className="focus-ring min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-field border-0 bg-transparent px-3 text-callout font-semibold text-neutral-content"
          onClick={runAction}
        >
          <span className="link-swipe">{toast.actionLabel}</span>
        </button>
      )}
      <button
        type="button"
        aria-label={t("common.close")}
        className="focus-ring -ml-[13px] inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-neutral-content/70 transition-colors hover:text-neutral-content"
        onClick={() => onDismiss(toast.id)}
      >
        <XIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
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
  const regionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={regionRef}
      className="toast toast-bottom toast-start pointer-events-none z-[110] w-full max-w-[600px] whitespace-normal px-gutter"
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {toast && (
        <ToastAlert
          key={toast.id}
          toast={toast}
          duration={duration}
          onDismiss={onDismiss}
          regionRef={regionRef}
        />
      )}
    </div>
  );
}
