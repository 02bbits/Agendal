import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { t } from "../copy";
import { cx } from "./cx";
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
  const [flipUp, setFlipUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isWide = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!open || !isWide) return;
    const triggerEl = triggerRef?.current ?? containerRef.current;
    if (triggerEl && typeof window !== "undefined") {
      const rect = triggerEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setFlipUp(spaceBelow < 320 && spaceAbove > spaceBelow);
    }
  }, [open, isWide, triggerRef]);

  useEffect(() => {
    if (!open || !isWide) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, isWide, onClose]);

  const onPopoverKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      const triggerEl =
        triggerRef?.current ??
        containerRef.current?.querySelector<HTMLElement>("button");
      triggerEl?.focus();
    }
  };

  return (
    <div ref={containerRef} className={cx("relative inline-block", className)}>
      {trigger}
      {open && isWide && (
        <div
          role="presentation"
          onKeyDown={onPopoverKeyDown}
          className={cx(
            "absolute z-50 min-w-full max-h-[320px] overflow-y-auto rounded-box border border-separator bg-surface-elevated p-1 shadow-md motion-safe:animate-fade-in",
            flipUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "right" ? "right-0" : "left-0",
            popoverClassName,
          )}
        >
          {children}
        </div>
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
