import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Button } from "../../components/Button";
import { BellIcon, ChevronDownIcon, XIcon } from "../../components/icons";
import { t } from "../../copy";
import { cx } from "../../components/cx";
import type { ReminderAlert } from "./reminderAlertStore";

export const REMINDER_BANNER_DURATION_MS = 8000;

export interface ReminderReturnBannerProps {
  alert: ReminderAlert | null;
  alerts?: readonly ReminderAlert[];
  count: number;
  duration?: number;
  onView?: (alert: ReminderAlert) => void;
  onSelectAlert?: (alert: ReminderAlert) => void;
  onDismissAlert?: (id: string) => void;
  onClearAll?: () => void;
  onDismiss: () => void;
  onAutoDismiss?: () => void;
}

/**
 * Return-to-app motion banner (#186): gracefully alerts the user with smooth motion
 * when they switch back to the Agendal tab while a task reminder is active.
 *
 * Rendered at the top of the flat view content column, centered with mx-auto.
 * Expands in-place with a smooth accordion animation when clicking View.
 */
export function ReminderReturnBanner({
  alert,
  alerts,
  count,
  duration = REMINDER_BANNER_DURATION_MS,
  onView,
  onSelectAlert,
  onDismissAlert,
  onClearAll,
  onDismiss,
  onAutoDismiss,
}: ReminderReturnBannerProps): ReactElement | null {
  const [prevAlertId, setPrevAlertId] = useState<string | null>(
    alert?.id ?? null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const dragStartRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLElement>(null);

  // Idiomatic React pattern for resetting state when alert prop/identity changes without triggering an extra effect render
  const currentAlertId = alert?.id ?? null;
  if (currentAlertId !== prevAlertId) {
    setPrevAlertId(currentAlertId);
    setIsOpen(false);
  }

  const activeAlerts =
    alerts && alerts.length !== 0 ? alerts : alert ? [alert] : [];
  const handleSelect = onSelectAlert || onView;
  const handleAutoDismiss = onAutoDismiss || onDismiss;

  const handleDismissBanner = useCallback(() => {
    setIsOpen(false);
    onDismiss();
  }, [onDismiss]);

  // Auto-dismiss timer (paused when hovered, dragged or when expanded)
  useEffect(() => {
    if (!alert || isHovered || isOpen || dragOffset !== 0 || duration <= 0)
      return;

    const timer = setTimeout(() => {
      setIsOpen(false);
      handleAutoDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [alert, isHovered, isOpen, dragOffset, duration, handleAutoDismiss]);

  const onMouseEnter = useCallback(() => setIsHovered(true), []);
  const onMouseLeave = useCallback(() => setIsHovered(false), []);

  const isButtonAction = (e: React.SyntheticEvent) =>
    (e.target as Element).closest?.("button, [role='button']") !== null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isButtonAction(e)) return;
    setIsHovered(true);
    dragStartRef.current = e.touches[0].clientX;
    dragOffsetRef.current = 0;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || dragStartRef.current === null) return;
    e.stopPropagation();
    const diff = e.touches[0].clientX - dragStartRef.current;
    dragOffsetRef.current = diff;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const finalOffset = dragOffsetRef.current;
    if (Math.abs(finalOffset) > 70) {
      const exitTarget = (finalOffset > 0 ? 1 : -1) * 160;
      setIsExiting(true);
      setDragOffset(exitTarget);
      setTimeout(() => {
        setIsOpen(false);
        onDismiss();
        if (typeof window !== "undefined" && window.scrollX !== 0) {
          window.scrollTo({ left: 0 });
        }
      }, 180);
    } else {
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setIsHovered(false);
    }
    if (typeof window !== "undefined" && window.scrollX !== 0) {
      window.scrollTo({ left: 0 });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (
      e.pointerType === "mouse" ||
      (e.button !== undefined && e.button !== 0) ||
      isButtonAction(e)
    ) {
      return;
    }
    setIsHovered(true);
    dragStartRef.current = e.clientX ?? 0;
    dragOffsetRef.current = 0;
    isDraggingRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored in tests
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
      // Ignored
    }
    const finalOffset = dragOffsetRef.current;
    if (Math.abs(finalOffset) > 70) {
      const exitTarget = (finalOffset > 0 ? 1 : -1) * 160;
      setIsExiting(true);
      setDragOffset(exitTarget);
      setTimeout(() => {
        setIsOpen(false);
        onDismiss();
        if (typeof window !== "undefined" && window.scrollX !== 0) {
          window.scrollTo({ left: 0 });
        }
      }, 180);
    } else {
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setIsHovered(false);
    }
    if (typeof window !== "undefined" && window.scrollX !== 0) {
      window.scrollTo({ left: 0 });
    }
  };

  if (!alert || activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-3 z-40 h-0 w-full max-w-full [overflow-x:clip] overflow-y-visible pointer-events-none">
      <div className="flex justify-center px-2 sm:px-0 pointer-events-none w-full max-w-full [overflow-x:clip]">
        <aside
          ref={containerRef}
          role="alert"
          aria-live="polite"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            transform: dragOffset ? `translateX(${dragOffset}px)` : undefined,
            opacity: dragOffset
              ? Math.max(0, 1 - Math.abs(dragOffset) / 160)
              : undefined,
            transition: isExiting
              ? "transform 180ms ease-out, opacity 180ms ease-out"
              : dragOffset
                ? "none"
                : "transform 180ms ease-out, opacity 180ms ease-out",
          }}
          className="animate-reminder-drop pointer-events-auto touch-pan-y select-none mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-separator/90 bg-surface/98 p-3 shadow-xl backdrop-blur-md"
        >
          {/* Top collapsed header bar */}
          <div className="flex w-full items-center gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
              <BellIcon size={20} className="animate-bell-ring" />
              <span
                className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-error ring-2 ring-surface"
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-callout font-semibold text-ink">
                  {count > 1
                    ? t("reminders.alert_many", { count })
                    : t("reminders.alert_one")}
                </span>
              </div>
              <p className="m-0 truncate text-footnote text-ink-secondary">
                {alert.title}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant={isOpen ? "outline" : "primary"}
                size="sm"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((prev) => !prev)}
                className="gap-1.5"
              >
                <span>{t("reminders.view")}</span>
                <ChevronDownIcon
                  size={14}
                  className={cx(
                    "transition-transform duration-300",
                    isOpen && "rotate-180",
                  )}
                />
              </Button>

              <button
                type="button"
                aria-label={t("reminders.dismiss")}
                onClick={handleDismissBanner}
                className="focus-ring hidden size-8 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-fill hover:text-ink transition-colors sm:inline-flex"
              >
                <XIcon size={16} />
              </button>
            </div>
          </div>

          {/* In-place expandable accordion section (#186) */}
          <div
            className={cx(
              "grid transition-all duration-300 ease-out",
              isOpen
                ? "grid-rows-[1fr] opacity-100 mt-2.5 pt-2 border-t border-separator/60"
                : "grid-rows-[0fr] opacity-0 mt-0 pt-0 border-t-0 pointer-events-none",
            )}
          >
            <div className="overflow-hidden">
              <div className="flex items-center justify-between px-1 pb-1.5 text-caption font-semibold text-ink-secondary">
                <span>{t("reminders.active_list")}</span>
                {activeAlerts.length > 1 && onClearAll && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onClearAll();
                    }}
                    className="focus-ring text-caption font-normal text-ink-secondary hover:text-ink transition-colors cursor-pointer"
                  >
                    {t("reminders.dismiss_all")}
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 py-0.5">
                {activeAlerts.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-fill"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        handleSelect?.(item);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full bg-error"
                        aria-hidden="true"
                      />
                      <span className="truncate text-footnote font-medium text-ink group-hover:text-primary transition-colors">
                        {item.title}
                      </span>
                    </button>
                    {onDismissAlert && (
                      <button
                        type="button"
                        aria-label={t("reminders.dismiss_item")}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismissAlert(item.id);
                        }}
                        className="focus-ring flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary hover:bg-surface hover:text-ink transition-colors"
                      >
                        <XIcon size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
