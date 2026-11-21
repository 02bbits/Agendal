import { WIDE_SCREEN } from "./useMediaQuery";
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
  /** Each toast has its own id; up to three show at once (UX-04, #168). */
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
  /** The stack's one pause: hover, focus or a touch on any toast holds every timer. */
  paused: boolean;
  pause: () => void;
  resume: () => void;
}

function ToastAlert({
  toast,
  duration,
  onDismiss,
  paused,
  pause,
  resume,
}: ToastAlertProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const dragStartRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, paused, duration, onDismiss]);

  // A press on Undo/Retry is a tap, not a drag: capturing it would send the click to the toast, not the button
  const onAction = (e: React.SyntheticEvent) =>
    (e.target as Element).closest?.("button") !== null;

  const isDesktop = () => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      return window.matchMedia(WIDE_SCREEN).matches;
    }
    return false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDesktop() || onAction(e)) return;
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
    // Swipe is only enabled for touch/pen on mobile, disabled for mouse and desktop
    if (
      e.pointerType === "mouse" ||
      isDesktop() ||
      (e.button !== undefined && e.button !== 0) ||
      onAction(e)
    ) {
      return;
    }
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
      className="alert pointer-events-auto flex min-h-11 w-fit max-w-full touch-pan-y select-none items-center gap-3 rounded-field border-0 bg-neutral py-2 pl-4 pr-4 text-callout text-neutral-content shadow-md md:pr-2 motion-safe:animate-slide-up md:motion-safe:animate-slide-in-left motion-reduce:animate-fade-quick"
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
          resume();
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
        className="focus-ring -ml-[13px] hidden size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-neutral-content/70 transition-colors hover:text-neutral-content md:inline-flex"
        onClick={() => onDismiss(toast.id)}
      >
        <XIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/** How many toasts show at once (#168): a fourth drops the oldest. */
export const MAX_TOASTS = 3;

export interface ToastStackProps {
  /** Oldest first, as they were shown; at most MAX_TOASTS are drawn. */
  toasts: readonly ToastData[];
  onDismiss: (id: ToastData["id"]) => void;
  /** Errors that block an action are assertive; everything else is polite (UX-60). */
  assertive?: boolean;
  duration?: number;
}

/**
 * Always-mounted live region with up to three toasts (#168): the newest on top, where it is seen
 * first, the oldest at the bottom. Each shows for 5 s; hover, focus or touch on any of them pauses
 * them all, and they start again when it leaves (UX-04, WCAG 2.2.1). Screen readers hear each new
 * toast once, not the whole stack again.
 */
export function ToastStack({
  toasts,
  onDismiss,
  assertive = false,
  duration = TOAST_DURATION_MS,
}: ToastStackProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    if (!regionRef.current?.contains(document.activeElement)) setPaused(false);
  }, []);
  const newestFirst = toasts.slice(-MAX_TOASTS).reverse();

  return (
    <div
      ref={regionRef}
      className="toast toast-bottom toast-center md:[--toast-x:0px] md:[inset-inline:1rem_auto] items-center md:items-start bottom-[calc(1.75rem+env(safe-area-inset-bottom,0px))] md:bottom-4 pointer-events-none z-[110] w-full max-w-[600px] whitespace-normal px-gutter"
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="false"
    >
      {newestFirst.map((toast) => (
        <ToastAlert
          key={toast.id}
          toast={toast}
          duration={duration}
          onDismiss={onDismiss}
          paused={paused}
          pause={pause}
          resume={resume}
        />
      ))}
    </div>
  );
}

/** One toast at a time: the stack with a single toast, for screens that keep their own. */
export function Toast({ toast, ...rest }: ToastProps) {
  return <ToastStack toasts={toast ? [toast] : []} {...rest} />;
}
