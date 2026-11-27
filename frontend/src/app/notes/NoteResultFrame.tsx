"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { useBackgroundScrollLock } from "../../ui/components/useBackgroundScrollLock";
import { useModalFocus } from "../../ui/components/useModalFocus";
import { cx } from "../../ui/components/cx";
import { PanelHeader } from "../../ui/features/tasks/details/PanelHeader";
import { t } from "../../ui/copy";

/**
 * While a note's result is open over a wide screen: focus stays in it, Escape asks to close, and the
 * shell behind can't be reached (like Task details). The flags let the shell make room for the side panel.
 */
export function useNoteModal(
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  wide: boolean,
  popup: boolean,
  requestClose: () => void,
): void {
  useModalFocus(panelRef, panelRef, open && wide, requestClose);
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.noteSelected = "open";
    // Only a side panel takes room from the column (like data-task-panel=aside); a popup sits over
    // it, so the capture bar and banners stay where they are
    if (wide && !popup) document.documentElement.dataset.notePanel = "open";
    return () => {
      delete document.documentElement.dataset.notePanel;
      delete document.documentElement.dataset.noteSelected;
    };
  }, [wide, popup, open]);
  useEffect(() => {
    if (!open || !wide) return;
    const background = [
      ...document.querySelectorAll<HTMLElement>("[data-shell-navigation]"),
    ];
    const previous = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    return () => {
      background.forEach((element, index) => {
        element.inert = previous[index]!;
      });
    };
  }, [open, wide]);
}

interface NoteResultFrameProps {
  /** Wide: a modal (a popup or a side panel, by Page view). Narrower: a page in the column. */
  wide: boolean;
  popup: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The frame a note's result opens in: on the Notes screen, and over any other screen after Make tasks
 * (the user stays where they wrote it). One tree for every width, so a resize doesn't remount the note.
 */
export function NoteResultFrame({
  wide,
  popup,
  panelRef,
  onClose,
  children,
}: NoteResultFrameProps) {
  return (
    <>
      {wide && (
        <div
          aria-hidden="true"
          className={cx(
            "fixed inset-0 z-[54] backdrop-blur-[2px] motion-safe:animate-fade-in",
            popup ? "bg-scrim/60" : "bg-scrim",
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
        />
      )}
      <div
        className={
          wide && popup
            ? "pointer-events-none fixed inset-0 z-[55] flex items-center justify-center p-4 sm:p-6 md:p-8"
            : "contents"
        }
      >
        <aside
          ref={panelRef}
          role={wide ? "dialog" : undefined}
          aria-modal={wide || undefined}
          tabIndex={-1}
          data-modal-host={wide || undefined}
          aria-label={t("nav.notes")}
          className={cx(
            "flex flex-col outline-none",
            wide &&
              (popup
                ? "pointer-events-auto max-h-[85vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-separator/60 bg-surface shadow-2xl motion-safe:animate-scale-in"
                : "fixed inset-y-0 right-0 z-[55] w-full max-w-[400px] border-l border-separator bg-surface pr-[env(safe-area-inset-right,0px)] shadow-2xl motion-safe:animate-panel-in"),
          )}
        >
          {wide && <NoteScrollLock panelRef={panelRef} />}
          {wide && <PanelHeader title={t("nav.notes")} onClose={onClose} />}
          <div
            className={
              wide
                ? "relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4"
                : undefined
            }
          >
            {children}
          </div>
        </aside>
      </div>
    </>
  );
}

function NoteScrollLock({
  panelRef,
}: {
  panelRef: RefObject<HTMLElement | null>;
}) {
  useBackgroundScrollLock(panelRef);
  return null;
}
