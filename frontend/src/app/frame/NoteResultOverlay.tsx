"use client";

import { useRef } from "react";
import { useHistoryEntry } from "@/ui/components/useHistoryEntry";
import NoteResultClient from "../notes/[id]/NoteResultClient";
import { NoteResultFrame, useNoteModal } from "../notes/NoteResultFrame";

/**
 * A note's result after Make tasks on a wide screen, over the screen the note was written on, so the
 * user stays there (the same popup or side panel as on the Notes screen). Back, ×, Escape and the
 * backdrop close it, after the result's own "Check this first" when it asks.
 */
export function NoteResultOverlay({
  id,
  popup,
  onClose,
}: {
  id: string;
  popup: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeGuard = useRef<(() => boolean) | null>(null);
  function requestClose(): boolean {
    if (closeGuard.current?.() === false) return false;
    onClose();
    return true;
  }
  useNoteModal(panelRef, true, true, popup, requestClose);
  useHistoryEntry(true, requestClose);

  return (
    <NoteResultFrame
      wide
      popup={popup}
      panelRef={panelRef}
      onClose={requestClose}
    >
      <NoteResultClient
        id={id}
        presentation="panel"
        onClose={onClose}
        closeGuardRef={closeGuard}
      />
    </NoteResultFrame>
  );
}
