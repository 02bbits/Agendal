import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { t } from "../copy";
import { cx } from "./cx";
import { placePopover } from "./popoverPosition";
import { Sheet } from "./Sheet";
import { useMediaQuery } from "./useMediaQuery";

export interface PopoverOrSheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  triggerRef?: RefObject<HTMLElement | null>;
  className?: string;
  popoverClassName?: string;
  align?: "left" | "right";
  closeLabel?: string;
}

/**
 * From 768px a popover next to the trigger, drawn in a portal with fixed
 * positioning so a scrolling parent (the task panel) can't clip it, and kept
 * inside the window. Below 768px a bottom sheet.
 */
export function PopoverOrSheet({
  open,
  onClose,
  label,
  trigger,
  children,
  triggerRef,
  className,
  popoverClassName,
  align = "left",
  closeLabel,
}: PopoverOrSheetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The nearest daisyUI .modal (Sheet, Dialog): the popover goes inside it so it
  // stacks above the modal and stays in its focus trap; else document.body.
  const [modalHost, setModalHost] = useState<Element | null>(null);
  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setModalHost(el?.closest(".modal") ?? null);
  }, []);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isWide = useMediaQuery("(min-width: 768px)");
  const showPopover = open && isWide;

  const place = useCallback(() => {
    const anchor = triggerRef?.current ?? containerRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;
    const { top, left, minWidth } = placePopover(
      anchor.getBoundingClientRect(),
      popover.offsetWidth,
      popover.offsetHeight,
      window.innerWidth,
      window.innerHeight,
      align,
    );
    Object.assign(popover.style, {
      top: `${top}px`,
      left: `${left}px`,
      minWidth: `${minWidth}px`,
      visibility: "visible",
    });
  }, [align, triggerRef]);

  useLayoutEffect(() => {
    if (!showPopover) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [showPopover, place]);

  useEffect(() => {
    if (!showPopover) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showPopover, onClose]);

  const onPopoverKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    onClose();
    (
      triggerRef?.current ??
      containerRef.current?.querySelector<HTMLElement>("button")
    )?.focus();
  };

  return (
    <div ref={setContainer} className={cx("relative inline-block", className)}>
      {trigger}
      {showPopover &&
        createPortal(
          <div
            ref={popoverRef}
            role="presentation"
            onKeyDown={onPopoverKeyDown}
            style={{ top: 0, left: 0, visibility: "hidden" }}
            className={cx(
              "fixed z-50 max-w-[calc(100vw-16px)] overflow-y-auto rounded-box border border-separator bg-surface-elevated p-1 shadow-md motion-safe:animate-fade-in",
              popoverClassName,
            )}
          >
            {children}
          </div>,
          modalHost ?? document.body,
        )}
      {open && !isWide && (
        <Sheet
          open={open}
          title={label}
          onClose={onClose}
          closeLabel={closeLabel ?? t("common.close")}
        >
          {children}
        </Sheet>
      )}
    </div>
  );
}
