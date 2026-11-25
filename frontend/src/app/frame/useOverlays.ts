import { usePanelScreen } from "@/ui/components/useMediaQuery";
import { useCallback, useState } from "react";
import { ROUTES, type NoteResult, type SettingsTab } from "@/ui";

type Router = {
  push: (href: string) => void;
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

/** How long to wait for the editor's history entry to come off before opening the result. */
const EDITOR_CLOSE_WAIT_MS = 250;

/** Which layer is open over the screen: the note editor, the search popup or Settings. */
export function useOverlays(pathname: string, router: Router) {
  const notePanelWide = usePanelScreen();

  const [editing, setEditing] = useState(false);
  // The dictation sheet, from the capture bar's mic (NC §2.3), and the words it hands the editor
  const [dictating, setDictating] = useState(false);
  const [dictatedText, setDictatedText] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<NoteResult["note"] | null>(
    null,
  );
  const openNoteEditor = useCallback(() => {
    setEditingNote(null);
    setDictatedText(null);
    setEditing(true);
  }, []);
  const openDictation = useCallback(() => setDictating(true), []);
  const closeDictation = useCallback(() => setDictating(false), []);
  const editDictated = useCallback((text: string) => {
    setEditingNote(null);
    setDictatedText(text);
    setEditing(true);
  }, []);
  const editFollowupNote = useCallback((note: NoteResult["note"]) => {
    setEditingNote(note);
    setDictatedText(null);
    setEditing(true);
  }, []);
  const closeNoteEditor = useCallback(() => {
    setEditing(false);
    setEditingNote(null);
    setDictatedText(null);
  }, []);

  // Closing the editor takes its history entry off with history.back(), which is only done a
  // moment later. The result goes on top of where the editor was opened once that has happened,
  // so Back from the result returns there and never to the editor (RV-E12). A router.replace
  // over the editor's entry would be undone by that back
  const openResult = useCallback(
    (id: string) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        window.removeEventListener("popstate", go);
        const target = notePanelWide
          ? `/notes?note=${encodeURIComponent(id)}`
          : ROUTES.note(id);
        if (window.location.pathname + window.location.search === target)
          router.replace(target, { scroll: false });
        else router.push(target);
      };
      window.addEventListener("popstate", go);
      // The entry wasn't on top (nothing to take off): no popstate comes
      setTimeout(go, EDITOR_CLOSE_WAIT_MS);
      setEditing(false);
    },
    [router, notePanelWide],
  );

  const [searching, setSearching] = useState(false);
  const openSearch = useCallback(() => setSearching(true), []);
  const closeSearch = useCallback(() => setSearching(false), []);

  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const openSettings = useCallback(
    (tab?: SettingsTab) => {
      // On /account Settings is the page itself: the menu's Settings leaves it
      if (pathname === ROUTES.account) router.replace(ROUTES.inbox);
      else setSettingsTab(tab ?? "general");
    },
    [pathname, router],
  );
  const closeSettings = useCallback(() => setSettingsTab(null), []);

  return {
    note: {
      editing,
      editingNote,
      dictating,
      dictatedText,
      openNoteEditor,
      openDictation,
      closeDictation,
      editDictated,
      editFollowupNote,
      closeNoteEditor,
      openResult,
    },
    search: { searching, openSearch, closeSearch },
    settings: { settingsTab, openSettings, closeSettings },
  };
}

export type Overlays = ReturnType<typeof useOverlays>;
