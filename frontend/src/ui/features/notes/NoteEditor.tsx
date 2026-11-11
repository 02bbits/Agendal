import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  clearDraft,
  keepDraftOnHide,
  loadDraft,
  saveDraft,
} from "../../../lib/draft";
import type { NoteReplan, NoteSubmitFailure } from "../../../lib/noteApi";
import { t } from "../../copy";
import type { NoteResult } from "../../domain/types";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { cx } from "../../components/cx";
import { Dialog } from "../../components/Dialog";
import { SparklesIcon } from "../../components/icons";
import { useHistoryEntry } from "../../components/useHistoryEntry";
import { useModalFocus } from "../../components/useModalFocus";
import { UndoConflictDialog } from "./UndoConflictDialog";

const EXAMPLES = [
  "note.example_1",
  "note.example_2",
  "note.example_3",
] as const;

// NU-E15: spaces, line breaks and zero-width characters are not text
const VISIBLE = /[^\s​-‍⁠﻿]/;

export interface NoteEditorProps {
  /** Editing a saved follow-up stays separate from the unsent new-note draft. */
  note?: NoteResult["note"];
  /** Called when the editor closes: at once when it is empty, otherwise after Discard (UX-13). */
  onClose: () => void;
  /** An earlier unsent note was put back in the editor (`note.draft_restored`). */
  onDraftRestored?: () => void;
  /**
   * Make tasks, and Ctrl/Cmd+Enter (UX-12): sends the note (NC §2.2) and answers with the result,
   * or why it wasn't made. `clientId` stays the same for a retry, so one note is made at most once.
   * Editing a done note may answer `{conflicts}`: the editor asks first, then sends again with
   * `confirmConflicts` (RV-E16).
   */
  onSubmit?: (
    text: string,
    clientId: string,
    confirmConflicts: boolean,
  ) => NoteReplan;
  /** The note was made. The draft is already cleared; the editor stays until this closes it. */
  onSubmitted?: (result: NoteResult) => void;
}

/** The reading line shows only when the answer takes longer than this (NC §2.2). */
const READING_AFTER_MS = 300;

// NF-14: the client mirrors the server's notes.max_length; the counter shows from 4,500 (NC §2.1)
const NOTE_MAX = 5000;
const COUNTER_FROM = 4500;
// "full" is exactly 5,000: announced again, as A11Y-32 asks, but still allowed
type CounterStage = "hidden" | "near" | "full" | "over";
const stageOf = (length: number): CounterStage =>
  length > NOTE_MAX
    ? "over"
    : length === NOTE_MAX
      ? "full"
      : length >= COUNTER_FROM
        ? "near"
        : "hidden";
// Counted as the server counts (NoteSplitter::normalize, then mb_strlen): NFC, no control or
// format characters, trimmed, in code points
const lengthOf = (text: string) =>
  [
    ...text
      .normalize("NFC")
      .replace(/[^\P{Cc}\t\n]|\p{Cf}/gu, "")
      .replace(/[^\S\t\n]/gu, " ")
      .trim(),
  ].length;
const formatCount = (count: number) => count.toLocaleString("en-US");

/**
 * Full-screen note editor (NC-1, NC-2): the ruled note card with the cursor in it, three
 * example chips while it is empty, and Make tasks once there is something to read.
 */
export function NoteEditor({
  note,
  onClose,
  onDraftRestored,
  onSubmit,
  onSubmitted,
}: NoteEditorProps) {
  const [text, setText] = useState(note?.text ?? "");
  const latest = useRef(text);
  const dirty = useRef(false);
  const clientId = useRef(crypto.randomUUID());
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [failure, setFailure] = useState<NoteSubmitFailure | null>(null);
  // Tasks of the note edited by hand since: how many, while the dialog asks (RV-E16)
  const [conflicts, setConflicts] = useState(0);
  // Seconds until a rate-limited note may be sent again (429)
  const [wait, setWait] = useState(0);
  const errorId = useId();
  const counterId = useId();
  const edit = (next: string, saved = false) => {
    latest.current = next;
    dirty.current = !saved;
    setText(next);
    if (saved) return;
    // New words are a new note: the server would answer an old id with the old text (ADR-003).
    // A rate limit is about the user, not the text, so its countdown stays.
    clientId.current = crypto.randomUUID();
    setFailure((f) => (f?.error === "error.rate_limited" ? f : null));
  };
  const editorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const fieldId = useId();
  const [confirming, setConfirming] = useState(false);
  // ×, Escape and Back ask first when there is text; the draft only guards against a crash
  const requestClose = () => {
    // Closing mid-request would leave the answer with nowhere to go
    if (sending.current) return false;
    // The conflict dialog (RV-E16) closes first; the edited text stays
    if (conflicts > 0) {
      setConflicts(0);
      return false;
    }
    if (note && latest.current === note.text) return onClose();
    if (confirming) setConfirming(false);
    else if (VISIBLE.test(latest.current)) setConfirming(true);
    else return onClose();
    return false;
  };
  const discard = () => {
    dirty.current = false;
    if (!note) clearDraft().catch(() => {});
    onClose();
  };
  useModalFocus(editorRef, textRef, true, requestClose);
  useHistoryEntry(true, requestClose);

  // Focus runs in the opener's tap, before paint: iOS only opens the keyboard for focus
  // that happens inside the gesture, and an effect that waits a frame is too late (NC §2.1)
  useLayoutEffect(() => textRef.current?.focus(), []);

  // Restore the draft, unless the user has already started typing
  useEffect(() => {
    if (note) return;
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
  const save = useCallback(() => {
    if (note) return;
    if (!dirty.current) return;
    dirty.current = false;
    saveDraft(latest.current).catch(() => {});
  }, [note]);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(save, 500);
    return () => clearTimeout(timer);
  }, [text, save]);
  useEffect(() => {
    // The page may be going: a copy written at once, then the usual save (NC-E1)
    const onPageHide = () => {
      if (!note) keepDraftOnHide(latest.current);
      save();
    };
    const onHide = () => document.visibilityState !== "visible" && onPageHide();
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHide);
      save();
    };
  }, [note, save]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const length = lengthOf(text);
  const stage = stageOf(length);
  const counter = t("note.counter", {
    count: formatCount(length),
    max: formatCount(NOTE_MAX),
  });
  const tooLong = t("note.too_long", { count: formatCount(length) });
  // A11Y-32: announced once as the note reaches 4,500 and again past 5,000, not on every keystroke
  const [announced, setAnnounced] = useState({ stage, text: "" });
  if (announced.stage !== stage)
    setAnnounced({
      stage,
      text: stage === "over" ? tooLong : stage === "hidden" ? "" : counter,
    });

  const canSubmit = VISIBLE.test(text) && stage !== "over" && wait <= 0;
  const submit = async (confirmConflicts = false) => {
    // The ref, not `busy`: a second tap lands before React has re-rendered
    if (!canSubmit || !onSubmit || sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailure(null);
    const timer = setTimeout(() => setReading(true), READING_AFTER_MS);
    const result = await onSubmit(
      latest.current,
      clientId.current,
      confirmConflicts,
    );
    clearTimeout(timer);
    sending.current = false;
    setBusy(false);
    setReading(false);
    if ("conflicts" in result) return setConflicts(result.conflicts);
    if ("error" in result) {
      setFailure(result);
      setWait(result.retryAfter ?? 0);
      return;
    }
    // Same order as discard(): without dirty = false the unmount would save the text again
    dirty.current = false;
    if (!note) clearDraft().catch(() => {});
    onSubmitted?.(result);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  };
  // A finished countdown clears itself; every other failure stays until the next try or edit
  const message =
    failure && (failure.error !== "error.rate_limited" || wait > 0)
      ? t(failure.error, { seconds: wait, count: text.length })
      : null;
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
    <>
      <div
        ref={editorRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 top-0 bottom-[var(--keyboard-inset,0px)] z-[70] flex flex-col bg-paper"
      >
        <div className="mx-auto grid w-full max-w-[600px] grid-cols-[1fr_auto_1fr] items-center px-gutter pt-[env(safe-area-inset-top)] md:max-w-[712px] md:px-gutter-wide">
          <button
            type="button"
            className="focus-ring -ml-2 min-h-11 cursor-pointer justify-self-start rounded-field px-2 text-body text-primary hover:bg-fill"
            onClick={requestClose}
          >
            {t("common.cancel")}
          </button>
          <h2
            id={titleId}
            className="m-0 flex items-center gap-1.5 text-heading font-semibold"
          >
            <SparklesIcon size={16} />
            {t(note ? "note.edit" : "note.new_title")}
          </h2>
          <span />
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col gap-3.5 overflow-y-auto px-gutter pt-1.5 pb-4 md:max-w-[712px] md:px-gutter-wide">
          <div className="flex min-h-[429px] flex-col rounded-box bg-surface p-3.5 pb-[18px]">
            <label
              htmlFor={fieldId}
              className="mb-1.5 text-footnote font-medium text-ink-secondary"
            >
              {t("note.text_label")}
            </label>
            <textarea
              id={fieldId}
              ref={textRef}
              value={text}
              onChange={(event) => edit(event.target.value)}
              onKeyDown={onKeyDown}
              readOnly={busy}
              aria-invalid={message ? true : undefined}
              aria-describedby={
                [stage !== "hidden" && counterId, message && errorId]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              placeholder={t("note.placeholder")}
              className="focus:outline-none min-h-[368px] w-full flex-1 resize-none border-0 bg-transparent bg-[linear-gradient(transparent_24px,var(--color-fill-2)_24px)] bg-[length:100%_25px] p-0 pt-0.5 text-note text-ink [background-attachment:local] placeholder:text-ink-tertiary"
            />
          </div>
          {stage !== "hidden" && (
            <p
              id={counterId}
              className={cx(
                "m-0 text-footnote tabular-nums",
                stage === "over" ? "text-error" : "text-ink-secondary",
              )}
            >
              {counter}
              {stage === "over" && <> · {tooLong}</>}
            </p>
          )}
          <p aria-live="polite" className="sr-only">
            {announced.text}
          </p>
          <p className="m-0 text-footnote text-ink-secondary">
            {t("note.editor_hint")}
          </p>
          <p role="status" className="m-0 text-footnote text-ink-secondary">
            {reading ? t("note.reading") : ""}
          </p>
          {message && (
            <div className="flex items-center justify-between gap-3 pb-2">
              <p
                id={errorId}
                role="alert"
                className="m-0 text-footnote text-error"
              >
                {message}
              </p>
              {failure?.error === "note.send_failed" && (
                <Button variant="secondary" size="sm" onClick={() => submit()}>
                  {t("common.retry")}
                </Button>
              )}
            </div>
          )}
          {!VISIBLE.test(text) && (
            <div>
              <p className="m-0 mb-2 text-overline font-semibold text-ink-secondary uppercase">
                {t("note.examples_title")}
              </p>
              <ul className="m-0 flex list-none flex-col items-start gap-2 p-0">
                {EXAMPLES.map((key) => (
                  <li key={key}>
                    <Chip onClick={() => fillExample(t(key))}>{t(key)}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-separator bg-bar px-3 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-lg">
          <div className="mx-auto w-full max-w-[600px] md:max-w-[712px]">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              busy={busy}
              disabled={!canSubmit}
              onClick={() => submit()}
            >
              <SparklesIcon size={18} />
              {t(note ? "note.replan" : "note.make_tasks")}
            </Button>
          </div>
        </div>
      </div>
      <UndoConflictDialog
        count={conflicts}
        history={false}
        onConfirm={() => {
          setConflicts(0);
          void submit(true);
        }}
        onCancel={() => setConflicts(0)}
      />
      <Dialog
        open={confirming}
        history={false}
        title={t(note ? "note.discard_edit_title" : "note.discard_title")}
        description={t(note ? "note.discard_edit_body" : "note.discard_body")}
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="destructive" onClick={discard}>
              {t("common.discard_action")}
            </Button>
            <Button onClick={() => setConfirming(false)}>
              {t("common.keep_editing")}
            </Button>
          </>
        }
      />
    </>
  );
}
