"use client";
import { useEffect, useState } from "react";
import { usePanelScreen } from "@/ui/components/useMediaQuery";

import {
  NewTaskSheet,
  NoteEditor,
  ProjectSheet,
  ROUTES,
  t,
  type NewTaskSheetProps,
  type NoteHit,
  type Project,
  type ProjectWithCounts,
} from "@/ui";
import { createProject } from "@/lib/projectApi";
import {
  listNotes,
  noteEntriesToHits,
  notesChanged,
  rememberNote,
  replanNote,
  searchNotes,
  submitNote,
} from "@/lib/noteApi";
import { search } from "@/lib/taskApi";
import { appClock } from "../appClock";
import { useAppFrame } from "./AppFrameContext";
import { hasTaskPanel } from "./frameRoutes";
import {
  AppSettingsScreen,
  NoteResultOverlay,
  SearchPopup,
  warmOverlays,
} from "./lazyOverlays";
import type { Overlays } from "./useOverlays";

type Router = {
  push: (href: string, options?: { scroll?: boolean }) => void;
};

/** The layers over the screen: Settings, the note editor, search, New task and New project. */
export function AppOverlays({
  pathname,
  router,
  overlays,
  offline,
  projects,
  newTask,
  creatingProject,
  onCloseProjectSheet,
  onProjectCreated,
}: {
  pathname: string;
  router: Router;
  overlays: Overlays;
  offline: boolean;
  projects: ProjectWithCounts[];
  newTask: { open: boolean; sheetProps: NewTaskSheetProps };
  creatingProject: boolean;
  onCloseProjectSheet: () => void;
  onProjectCreated: (created: Project) => void;
}) {
  const { navigate, settings, showToast } = useAppFrame();
  const wide = usePanelScreen();
  const { note, search: searchPopup, settings: settingsPopup } = overlays;
  const { editingNote } = note;
  const [recentNotes, setRecentNotes] = useState<NoteHit[]>([]);
  useEffect(warmOverlays, []);

  useEffect(() => {
    if (!searchPopup.searching) return;
    let active = true;
    listNotes("all")
      .then((res) => {
        if (active) {
          setRecentNotes(noteEntriesToHits((res?.items ?? []).slice(0, 5)));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [searchPopup.searching]);

  // A task from search opens beside the list on a wide screen, or on its own page
  const openTask = (id: string) => {
    searchPopup.closeSearch();
    if (!wide) {
      navigate(ROUTES.task(id));
      return;
    }
    const query = `?task=${encodeURIComponent(id)}`;
    if (hasTaskPanel(pathname))
      router.push(`${pathname}${query}`, { scroll: false });
    else router.push(`${ROUTES.inbox}${query}`);
  };

  const openProject = (id: string) => {
    searchPopup.closeSearch();
    navigate(ROUTES.project(id));
  };

  return (
    <>
      {settingsPopup.settingsTab && pathname !== ROUTES.account && (
        <AppSettingsScreen
          portal
          initialTab={settingsPopup.settingsTab}
          onBack={settingsPopup.closeSettings}
        />
      )}
      {note.editing && (
        <NoteEditor
          note={editingNote ?? undefined}
          timeFormat={settings.timeFormat}
          onClose={note.closeNoteEditor}
          onDraftRestored={() => showToast(t("note.draft_restored"))}
          offline={offline}
          onQueued={(toast) => {
            note.closeNoteEditor();
            notesChanged();
            showToast(t(toast));
          }}
          onSubmit={
            editingNote
              ? (text, _clientId, confirmConflicts) =>
                  replanNote(editingNote.id, text, confirmConflicts)
              : submitNote
          }
          onSubmitted={(result) => {
            rememberNote(result);
            notesChanged(result.note.id);
            note.openResult(result.note.id);
          }}
        />
      )}
      {wide && note.resultId && (
        <NoteResultOverlay
          key={note.resultId}
          id={note.resultId}
          popup={settings.pageView !== "full"}
          onClose={note.closeResult}
        />
      )}
      {searchPopup.searching && (
        <SearchPopup
          clock={appClock}
          onClose={searchPopup.closeSearch}
          projects={projects}
          recentNotes={recentNotes}
          timeFormat={settings.timeFormat}
          searchTasks={search}
          searchNotes={searchNotes}
          onOpenTask={openTask}
          onOpenProject={openProject}
          onOpenNote={(id) => {
            searchPopup.closeSearch();
            if (wide) note.openResult(id);
            else navigate(ROUTES.note(id));
          }}
        />
      )}
      {newTask.open && (
        <NewTaskSheet
          {...newTask.sheetProps}
          weekStart={settings.weekStart}
          timeFormat={settings.timeFormat}
        />
      )}
      {creatingProject && (
        <ProjectSheet
          open
          projects={projects}
          onClose={onCloseProjectSheet}
          clock={appClock}
          onCreate={createProject}
          onCreated={onProjectCreated}
        />
      )}
    </>
  );
}
