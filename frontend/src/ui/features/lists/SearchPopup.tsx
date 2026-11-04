import { useRef, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useBackgroundScrollLock } from "../../components/useBackgroundScrollLock";
import { useModalFocus } from "../../components/useModalFocus";
import { t } from "../../copy";
import type { Clock } from "../tasks/types";
import { useToday } from "../tasks/useToday";
import { SearchPanel, type SearchPanelProps } from "./SearchPanel";

export interface SearchPopupProps extends Omit<
  SearchPanelProps,
  "variant" | "onCancel" | "inputRef" | "today"
> {
  clock: Clock;
  onClose: () => void;
}

/** Mount it only while open: it reads the clock, which a prerender can't. */
export function SearchPopup({
  clock,
  onClose,
  ...panelProps
}: SearchPopupProps): ReactElement | null {
  const today = useToday(clock);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useModalFocus(dialogRef, inputRef, true, onClose, inputRef);
  useBackgroundScrollLock(dialogRef);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-testid="search-backdrop"
      className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("search.dialog")}
        className="absolute top-1/2 left-1/2 flex max-h-[min(780px,calc(100dvh-64px))] w-[840px] max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden overscroll-contain rounded-[14px] bg-surface-elevated shadow-2xl"
      >
        <SearchPanel
          {...panelProps}
          today={today}
          variant="popup"
          inputRef={inputRef}
        />
      </div>
    </div>,
    document.body,
  );
}
