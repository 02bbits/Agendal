import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { loadDraft, saveDraft } from "../../../lib/draft";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { IconButton } from "../../components/IconButton";
import { XIcon } from "../../components/icons";
import { useHistoryEntry } from "../../components/useHistoryEntry";
import { useModalFocus } from "../../components/useModalFocus";

const EXAMPLES = [
  "note.example_1",
  "note.example_2",
  "note.example_3",
] as const;

// NU-E15: spaces, line breaks and zero-width characters are not text
const VISIBLE = /[^\s​-‍⁠﻿]/;

export interface NoteEditorProps {
  /** Called by ×, Escape and Back. The text is saved as a draft, so nothing asks first (UX-13). */
  onClose: () => void;
  /** An earlier unsent note was put back in the editor (`note.draft_restored`). */
  onDraftRestored?: () => void;
  /** Make tasks, and Ctrl/Cmd+Enter (UX-12). Submitting is IM-42. */
  onSubmit?: (text: string) => void;
}

/**
 * Full-screen note editor (NC-1, NC-2): the serif text area with the cursor in it, three
 * example chips while it is empty, and Make tasks once there is something to read.
 */
export function NoteEditor({
  onClose,
  onDraftRestored,
  onSubmit,
}: NoteEditorProps) {
  const [text, setText] = useState("");
  const latest = useRef(text);
  const dirty = useRef(false);
  const edit = (next: string, saved = false) => {
    latest.current = next;
    dirty.current = !saved;
    setText(next);
  };
  const editorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  useModalFocus(editorRef, textRef, true, onClose);
  useHistoryEntry(true, onClose);

  // Focus runs in the opener's tap, before paint: iOS only opens the keyboard for focus
  // that happens inside the gesture, and an effect that waits a frame is too late (NC §2.1)
  useLayoutEffect(() => textRef.current?.focus(), []);

  // Restore the draft, unless the user has already started typing
  useEffect(() => {
    let current = true;
    loadDraft()
      .then((draft) => {
        if (!current || !draft || latest.current) return;
        edit(draft, true);
        onDraftRestored?.();
        const field = textRef.current;
        requestAnimationFrame(() =>
          field?.setSelectionRange(draft.length, draft.length),
        );
      })
      .catch(() => {});
    return () => {
      current = false;
    };
    // Once, when the editor opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save 500 ms after the last keystroke, when the page is hidden or left, and on close
  const save = () => {
    if (!dirty.current) return;
    dirty.current = false;
    saveDraft(latest.current).catch(() => {});
  };
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(save, 500);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    const onHide = () => document.visibilityState !== "visible" && save();
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHide);
      save();
    };
  }, []);

  const canSubmit = VISIBLE.test(text);
  const submit = () => {
    if (canSubmit) onSubmit?.(text);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  };
  const fillExample = (example: string) => {
    edit(example);
    const field = textRef.current;
    field?.focus();
    // The cursor goes to the end, after React has put the example in the field
    requestAnimationFrame(() =>
      field?.setSelectionRange(example.length, example.length),
    );
  };

  return (
    <div
      ref={editorRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-x-0 top-0 bottom-[var(--keyboard-inset,0px)] z-[70] flex flex-col bg-paper"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col px-gutter md:max-w-[712px] md:px-gutter-wide">
        <div className="flex min-h-14 items-center pt-[env(safe-area-inset-top)]">
          <IconButton
            plain
            label={t("common.close")}
            icon={<XIcon />}
            onClick={onClose}
          />
          <h2 id={titleId} className="sr-only">
            {t("note.capture_open")}
          </h2>
        </div>
        <textarea
          ref={textRef}
          value={text}
          onChange={(event) => edit(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label={t("note.text_label")}
          placeholder={t("note.placeholder")}
          className="focus:outline-none min-h-0 w-full flex-1 resize-none border-0 bg-transparent py-2 font-serif text-dialog text-ink placeholder:text-ink-tertiary"
        />
        {!VISIBLE.test(text) && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0 pb-3">
            {EXAMPLES.map((key) => (
              <li key={key}>
                <Chip onClick={() => fillExample(t(key))}>{t(key)}</Chip>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-2 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <Button
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            onClick={submit}
          >
            {t("note.make_tasks")}
          </Button>
        </div>
      </div>
    </div>
  );
}
