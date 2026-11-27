import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { PanelHeader } from "../tasks/details/PanelHeader";
import {
  clearDraft,
  keepDraftOnHide,
  loadDraft,
  saveDraft,
} from "../../../lib/draft";
import { now, timeZone } from "../../../lib/clock";
import { canDictate } from "../../../lib/dictation";
import type { NoteReplan, NoteSubmitFailure } from "../../../lib/noteApi";
import { isCopyKey, t, tc, type CopyKey } from "../../copy";
import { formatDay, formatTime } from "../../domain/dates";
import { localDateTime } from "../../domain/edit";
import type { NoteResult, TimeFormat } from "../../domain/types";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import { Dialog } from "../../components/Dialog";
import { IconButton } from "../../components/IconButton";
import {
  ChevronUpIcon,
  ImageIcon,
  MicIcon,
  PaperclipIcon,
  SparklesIcon,
  XIcon,
} from "../../components/icons";
import { useHistoryEntry } from "../../components/useHistoryEntry";
import { useBackgroundScrollLock } from "../../components/useBackgroundScrollLock";
import { useModalFocus } from "../../components/useModalFocus";
import { useDrawerDrag } from "../../components/useDrawerDrag";
import { StatusMark } from "../../components/StatusMark";
import { DictationSheet } from "./DictationSheet";
import { UndoConflictDialog } from "./UndoConflictDialog";
import { api } from "../../../lib/api";
import { ApiRequestError, handleResponse } from "../../../lib/apiError";

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
   * Make tasks, and Ctrl+Enter (UX-12): sends the note (NC §2.2) and answers with the result,
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
  /** Offline, the button reads Save note (NC-6). */
  offline?: boolean;
  /** The note was kept on the device to be sent later (NC-6): the toast to show. The draft is cleared. */
  onQueued?: (toast: CopyKey) => void;
  /** The account's clock (AP-5), for the time the note was written. */
  timeFormat?: TimeFormat;
}

/** The reading line shows only when the answer takes longer than this (NC §2.2). */
const READING_AFTER_MS = 300;

/** "Reading your note…" with a shine passing over it, and the seconds since Make tasks (the rules and, for
 * a low-confidence note, the language model). Only the words are announced, not each second. */
/** A row of the tray menu: a round icon and a label that underlines on hover, like the app's links. */
function TrayItem({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="focus-ring flex w-full cursor-pointer items-center gap-3 rounded-2xl border-0 bg-transparent px-3 py-2 text-left text-body text-ink disabled:cursor-default disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-fill text-ink-secondary"
      >
        {icon}
      </span>
      <span className="link-swipe">{label}</span>
    </button>
  );
}

function ReadingStatus() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = now().getTime() - READING_AFTER_MS;
    const id = setInterval(
      () => setSeconds(Math.floor((now().getTime() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <StatusMark />
      <span className="shiny-text">{t("note.reading")}</span>
      <span aria-hidden="true" className="tabular-nums">
        {" · "}
        {t("note.reading_seconds", { seconds })}
      </span>
    </>
  );
}

// NF-14: the client mirrors the server's notes.max_length; the counter shows from 4,500 (NC §2.1)
const NOTE_MAX = 5000;
// The most lines a note takes: well above the 30 items a note can hold, so blank lines and wrapped
// thoughts never hit it (NF-14)
const NOTE_MAX_LINES = 200;
// How often a new note's time is brought up to date while the editor is open
const CLOCK_TICK_MS = 10_000;
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

// File to note (NC §2.4): what the picker offers and the server reads, and the size it accepts
const FILE_TYPES = [
  ".txt",
  ".md",
  ".csv",
  ".pdf",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];
const FILE_MAX_BYTES = 5 * 1024 * 1024;
// The file card's tile (NC §2.4): a photo shows a picture, any other file its type, each in its own colour
const PHOTO_TYPES = ["jpg", "jpeg", "png", "webp"];
const FILE_TILES: { [extension: string]: string } = {
  pdf: "bg-danger-tint text-error",
  docx: "bg-due-tint text-due-ink",
  csv: "bg-success-tint text-success",
  md: "bg-warning-tint text-warning",
};
function extensionOf(name: string): string {
  return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024)
    return t("note.file_size_kb", {
      size: Math.max(1, Math.round(bytes / 1024)),
    });
  return t("note.file_size_mb", { size: (bytes / 1024 / 1024).toFixed(1) });
}

/** The attached file (one per note) and the text it put in the note, to take back out on × (NC §2.4). */
interface Attachment {
  name: string;
  size: number;
  pages: number | null;
  block: string;
  /** The note before the file's text, which was added at the end: an edited block is found after it. */
  before: string;
  truncated: boolean;
}

/**
 * Note editor (NC-1, NC-2): a drawer over the screen with the time it was written, the ruled note
 * card with the cursor in it, three example chips while it is empty, and Make tasks once there is
 * something to read. The ^ beside Make tasks opens the tools: dictation and a file.
 */
export function NoteEditor({
  note,
  onClose,
  onDraftRestored,
  onSubmit,
  onSubmitted,
  offline,
  onQueued,
  timeFormat = "24h",
}: NoteEditorProps) {
  const [text, setText] = useState(note?.text ?? "");
  const latest = useRef(text);
  const dirty = useRef(false);
  const clientId = useRef(crypto.randomUUID());
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<CopyKey | null>(null);
  // A file is being dragged over the note: the paper shows where it will go
  const [dropping, setDropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const paperScroll = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const fieldId = useId();
  const [confirming, setConfirming] = useState(false);
  // ×, Escape and Back ask first when there is text; the draft only guards against a crash
  const requestClose = () => {
    // Closing mid-request would leave the answer with nowhere to go
    if (sending.current || uploading) return false;
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
  // As for the app's popups: the page behind is dimmed and doesn't scroll
  useBackgroundScrollLock(editorRef);
  useHistoryEntry(true, requestClose);
  const drawer = useDrawerDrag(requestClose);

  // Focus runs in the opener's tap, before paint: iOS only opens the keyboard for focus
  // that happens inside the gesture, and an effect that waits a frame is too late (NC §2.1)
  useLayoutEffect(() => textRef.current?.focus(), []);

  // The paper grows with the text instead of scrolling inside the field, and the editor scrolls as one
  // page: a textarea's own scroll doesn't move its ruled background in every browser, so the words
  // would slide over the lines. Measured again when the text or the width changes.
  const fit = useCallback(() => {
    const field = textRef.current;
    if (!field) return;
    field.style.height = "auto";
    // The text's own height, without the empty ruled lines the field's min height adds
    field.style.minHeight = "0";
    const textHeight = field.scrollHeight;
    field.style.minHeight = "";
    field.style.height = `${field.scrollHeight}px`;
    // The field no longer scrolls to its cursor, so writing at the end keeps the end of the text in
    // view (not the end of the paper, whose empty lines run on below it)
    const scroller = paperScroll.current;
    if (
      scroller &&
      document.activeElement === field &&
      field.selectionEnd === field.value.length
    ) {
      const end =
        field.getBoundingClientRect().top +
        textHeight -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      if (end > scroller.scrollTop + scroller.clientHeight)
        scroller.scrollTop = end - scroller.clientHeight;
    }
  }, []);
  useLayoutEffect(fit, [text, fit]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

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
    // Back on the page: the text is saved here again, which drops the copy. Left in place, a copy
    // older than what is typed next would come back after a crash (NC-E1)
    const onBack = () => {
      if (!note) saveDraft(latest.current).catch(() => {});
    };
    const onVisibility = () =>
      document.visibilityState === "visible" ? onBack() : onPageHide();
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
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

  const canSubmit =
    VISIBLE.test(text) && stage !== "over" && wait <= 0 && !uploading;
  // Cancel while the note is read: its answer is set aside and the note stays to edit. The request
  // isn't aborted (that would read as no connection and queue the note); the same client id makes a
  // later Make tasks the same note on the server, not a second one (ADR-003)
  const submitRun = useRef(0);
  const readingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  function cancelSubmit() {
    submitRun.current++;
    clearTimeout(readingTimer.current);
    sending.current = false;
    setBusy(false);
    setReading(false);
  }
  const submit = async (confirmConflicts = false) => {
    // The ref, not `busy`: a second tap lands before React has re-rendered
    if (!canSubmit || !onSubmit || sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailure(null);
    const run = ++submitRun.current;
    readingTimer.current = setTimeout(() => setReading(true), READING_AFTER_MS);
    const result = await onSubmit(
      latest.current,
      clientId.current,
      confirmConflicts,
    );
    if (run !== submitRun.current) return;
    clearTimeout(readingTimer.current);
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
    if ("queued" in result) onQueued?.(result.queued);
    else onSubmitted?.(result);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    } else if (
      event.key === "Enter" &&
      latest.current.split("\n").length >= NOTE_MAX_LINES
    )
      event.preventDefault();
  };
  // A finished countdown clears itself; every other failure stays until the next try or edit
  const message =
    failure && (failure.error !== "error.rate_limited" || wait > 0)
      ? t(failure.error, { seconds: wait, count: text.length })
      : null;

  // The ^ tray: dictation and a file (NC §2.3, §2.4)
  const [tools, setTools] = useState(false);
  const [dictating, setDictating] = useState(false);
  // Where the dictated words go: the selection when the mic was tapped, or the end
  const dictationAt = useRef<[number, number] | null>(null);
  // A file or dictation over a note that already has text asks first: Replace or Add (NC §2.3, §2.4)
  const [choosing, setChoosing] = useState<((replace: boolean) => void) | null>(
    null,
  );
  const replaceNext = useRef(false);
  useEffect(() => {
    if (!tools) return;
    function closeOutside(event: PointerEvent) {
      if (!(event.target as Element).closest("[data-note-tray]"))
        setTools(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [tools]);
  function withMode(run: (replace: boolean) => void) {
    if (VISIBLE.test(latest.current)) setChoosing(() => run);
    else run(false);
  }
  // In the button's tap, so the recorder and the file picker may still start (iOS needs the tap)
  function choose(replace: boolean) {
    const run = choosing;
    setChoosing(null);
    run?.(replace);
  }
  const startDictation = (replace: boolean) => {
    const field = textRef.current;
    dictationAt.current = replace
      ? [0, latest.current.length]
      : field
        ? [field.selectionStart, field.selectionEnd]
        : null;
    setTools(false);
    setDictating(true);
  };
  const insertWords = (words: string) => {
    const end = latest.current.length;
    const [from, to] = dictationAt.current ?? [end, end];
    const before = latest.current.slice(0, from);
    const after = latest.current.slice(to);
    const lead = before && !/\s$/.test(before) ? " " : "";
    const tail = after && !/^\s/.test(after) ? " " : "";
    // Only the words that fit in the note's 5,000 (NF-14)
    const fitting = words.slice(
      0,
      Math.max(0, NOTE_MAX - (before + lead + tail + after).length),
    );
    edit(before + lead + fitting + tail + after);
    setDictating(false);
    const cursor = (before + lead + fitting).length;
    const field = textRef.current;
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(cursor, cursor);
    });
  };
  // "Today 15:35": a new note shows the time now and keeps up while it is open (it is sent with the
  // time of Make tasks); a saved one shows when it was written
  const [clock, setClock] = useState(now);
  useEffect(() => {
    if (note) return;
    const id = setInterval(() => setClock(now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [note]);
  const writtenAt = note?.written_at ?? clock.toISOString();
  const zone = timeZone();
  const written = localDateTime(writtenAt, zone);
  const stamp = `${formatDay(written.date, localDateTime(now().toISOString(), zone).date)} ${formatTime(written.time, timeFormat)}`;

  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [removingFile, setRemovingFile] = useState(false);
  const uploadAbort = useRef<AbortController | null>(null);
  // From Upload file or a file dropped on the note (NC §2.4); one file per note
  const uploadFile = async (file: File, replace: boolean) => {
    if (uploading || busy || attachment) return;
    if (offline) return setUploadError("note.file_offline");
    setUploadError(null);

    // Checked here before uploading, and again on the server (NC §2.4)
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!FILE_TYPES.includes(extension))
      return setUploadError("note.file_type");
    if (file.size > FILE_MAX_BYTES) return setUploadError("note.file_too_big");

    const formData = new FormData();
    formData.append("file", file);
    const abort = new AbortController();
    uploadAbort.current = abort;
    setUploading(true);
    try {
      const read = await handleResponse<{
        text: string;
        truncated: boolean;
        file_name: string;
        pages: number | null;
      }>(
        await api("/notes/extract", {
          method: "POST",
          body: formData,
          signal: abort.signal,
        }),
      );
      // Added at the end, after a blank line; text that doesn't fit is refused, nothing is added (NC-E9)
      const current = replace ? "" : latest.current.trimEnd();
      const gap = VISIBLE.test(current) ? "\n\n" : "";
      if ((current + gap + read.text).length > NOTE_MAX)
        return setUploadError("note.file_too_long");
      const block = read.text;
      const start = current.length + gap.length;
      edit(current + gap + block);
      setAttachment({
        name: read.file_name,
        size: file.size,
        pages: read.pages,
        block,
        before: current + gap,
        truncated: read.truncated,
      });
      // The cursor goes to the start of the file's text, to check it
      const field = textRef.current;
      requestAnimationFrame(() => {
        field?.focus();
        field?.setSelectionRange(start, start);
      });
    } catch (error) {
      if (abort.signal.aborted) return;
      // The field error is a copy key; anything else (network, 5xx) reads as "couldn't read"
      const code =
        error instanceof ApiRequestError
          ? error.status === 429
            ? "error.rate_limited_soon"
            : error.status === 413
              ? "note.file_too_big"
              : (error.fields?.file?.[0] ?? "")
          : "";
      setUploadError(isCopyKey(code) ? code : "note.file_failed");
    } finally {
      uploadAbort.current = null;
      setUploading(false);
    }
  };
  // × on the file card: its text goes too while unchanged; once edited, the user picks (NC §2.4)
  const removeFile = (withText: boolean) => {
    setRemovingFile(false);
    if (withText && attachment) {
      const text = latest.current;
      const at = text.lastIndexOf(attachment.block);
      if (at >= 0)
        edit(
          (
            text.slice(0, at).trimEnd() +
            "\n" +
            text.slice(at + attachment.block.length).trimStart()
          ).trim(),
        );
      // Edited: the file's text was added at the end, so it is what follows the earlier note.
      // ponytail: words typed after the file's text go with it; track the block's range if that matters
      else if (text.startsWith(attachment.before))
        edit(text.slice(0, attachment.before.length).trimEnd());
    }
    setAttachment(null);
  };
  const askRemoveFile = () => {
    if (!attachment) return;
    if (latest.current.includes(attachment.block)) removeFile(true);
    else setRemovingFile(true);
  };

  return (
    <>
      {/* A phone: a drawer that slides up from the capture bar; from 768px a popup in the middle of the
          screen, like Task details. Either is as tall as the note (so nothing scrolls and the
          margins stay even) up to the screen's height, over the content column; the tray floats over the
          note's bottom, so opening it never moves the drawer. A tap on the dimmed screen closes it like Cancel */}
      <div
        className="fixed inset-0 z-[70] bg-scrim backdrop-blur-[2px] motion-safe:animate-fade-in md:flex md:items-center md:justify-center md:p-8"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
        // A file dropped anywhere over the note is uploaded, never opened by the browser over the note
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDropping(false);
        }}
        onDrop={(event) => {
          const file = event.dataTransfer.files[0];
          if (!file) return;
          event.preventDefault();
          setDropping(false);
          withMode((replace) => void uploadFile(file, replace));
        }}
      >
        <div
          ref={editorRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="absolute inset-x-0 bottom-[var(--keyboard-inset,0px)] mx-auto flex max-h-[calc(100dvh-env(safe-area-inset-top)-24px-var(--keyboard-inset,0px))] min-h-[200px] w-full max-w-[600px] flex-col rounded-t-sheet bg-paper shadow-lg motion-safe:animate-slide-up md:relative md:inset-auto md:mx-0 md:max-h-[calc(100dvh-64px)] md:max-w-[712px] md:overflow-hidden md:rounded-2xl md:border md:border-separator/60 md:shadow-2xl md:motion-safe:animate-scale-in"
          style={drawer.style}
        >
          <div
            aria-hidden="true"
            className="flex shrink-0 cursor-grab touch-none justify-center select-none pt-2 pb-1 md:hidden"
            {...drawer.grabber}
          >
            <span className="h-1 w-9 rounded-full bg-fill-2" />
          </div>
          {/* From 768px the header of the app's popups (Task details): the title on the left, × on the right */}
          <div className="hidden md:block">
            <PanelHeader
              title={t(note ? "note.edit" : "note.new_title")}
              onClose={requestClose}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-gutter pt-1 md:hidden">
            <button
              type="button"
              className="focus-ring -ml-2 min-h-11 cursor-pointer justify-self-start rounded-field border-0 bg-transparent px-2 text-body text-primary"
              onClick={requestClose}
            >
              {/* The underline swipes in on hover and focus, like every way back in the app */}
              <span className="link-swipe">{t("common.cancel")}</span>
            </button>
            <h2 id={titleId} className="m-0 text-heading font-semibold">
              {t(note ? "note.edit" : "note.new_title")}
            </h2>
            <span />
          </div>
          <p className="m-0 text-center text-overline font-semibold text-ink-secondary uppercase tabular-nums md:pt-4">
            <time dateTime={writtenAt}>{stamp}</time>
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-gutter pt-4 pb-3 [scrollbar-width:none] md:px-gutter-wide">
            {attachment && (
              <div className="flex shrink-0 items-center gap-3 rounded-box bg-surface p-4">
                <span
                  aria-hidden="true"
                  className={`grid size-10 shrink-0 place-items-center rounded-tile text-[11px] font-bold uppercase ${FILE_TILES[extensionOf(attachment.name)] ?? "bg-primary-tint text-ink-secondary"}`}
                >
                  {PHOTO_TYPES.includes(extensionOf(attachment.name)) ? (
                    <ImageIcon size={20} />
                  ) : (
                    extensionOf(attachment.name)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-body font-semibold">
                    {attachment.name}
                  </p>
                  <p className="m-0 text-footnote text-ink-secondary tabular-nums">
                    {formatSize(attachment.size)}
                    {attachment.pages !== null &&
                      ` · ${tc("note.file_pages", attachment.pages)}`}
                  </p>
                </div>
                <IconButton
                  className="shrink-0 bg-fill!"
                  label={t("note.file_remove", { name: attachment.name })}
                  icon={<XIcon size={18} />}
                  disabled={busy}
                  onClick={askRemoveFile}
                />
              </div>
            )}
            <div
              ref={paperScroll}
              // The paper keeps its size and the text scrolls inside it, however much is written;
              // dragged smaller on a phone, it shrinks with the drawer
              className={cx(
                "flex min-h-0 flex-col overflow-y-auto rounded-box bg-surface p-4 [scrollbar-width:none]",
                drawer.dragged ? "flex-1" : "shrink grow-0 basis-[429px]",
                dropping && "outline-2 outline-primary outline-dashed",
              )}
            >
              <label htmlFor={fieldId} className="sr-only">
                {attachment
                  ? t("note.text_label_from", { name: attachment.name })
                  : t("note.text_label")}
              </label>
              <textarea
                id={fieldId}
                ref={textRef}
                value={text}
                onChange={(event) => {
                  const lines = event.target.value.split("\n");
                  edit(
                    lines.length > NOTE_MAX_LINES
                      ? lines.slice(0, NOTE_MAX_LINES).join("\n")
                      : event.target.value,
                  );
                }}
                // NF-14: the note stops at 5,000; a paste keeps only what fits
                maxLength={NOTE_MAX}
                onKeyDown={onKeyDown}
                readOnly={busy || uploading}
                aria-invalid={message ? true : undefined}
                aria-describedby={
                  [stage !== "hidden" && counterId, message && errorId]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                placeholder={t("note.placeholder")}
                className="focus:outline-none min-h-full w-full shrink-0 resize-none overflow-hidden border-0 bg-transparent bg-[linear-gradient(transparent_23px,var(--color-fill-2)_23px)] bg-[length:100%_24px] leading-6 p-0 pt-0.5 text-note text-ink [background-attachment:local] placeholder:text-ink-tertiary"
              />
            </div>
            <p aria-live="polite" className="sr-only">
              {announced.text}
            </p>
            {/* Status, counter and errors share one place under the paper that keeps room for a line,
                so the drawer (as tall as the note) doesn't grow or jump when one shows */}
            <div className="-mt-2 flex min-h-5 flex-col gap-1">
              {uploadError && (
                <p role="alert" className="m-0 text-footnote text-error">
                  {t(uploadError)}
                </p>
              )}
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
              {attachment?.truncated && (
                <p className="m-0 text-footnote text-ink-secondary">
                  {t("note.file_truncated")}
                </p>
              )}
              {/* Always there, so screen readers hear it when it fills; hidden while empty */}
              <p
                role="status"
                className={cx(
                  "m-0 text-footnote text-ink-secondary",
                  !reading && !uploading && "sr-only",
                )}
              >
                {reading ? (
                  <ReadingStatus />
                ) : uploading ? (
                  <>
                    <StatusMark />
                    <span className="shiny-text">{t("note.reading_file")}</span>
                  </>
                ) : (
                  ""
                )}
              </p>
              {message && (
                <div className="flex items-center justify-between gap-3">
                  <p
                    id={errorId}
                    role="alert"
                    className="m-0 text-footnote text-error"
                  >
                    {message}
                  </p>
                  {failure?.error === "note.send_failed" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => submit()}
                    >
                      {t("common.retry")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="relative border-t border-separator bg-bar px-gutter pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-lg md:px-gutter-wide md:pb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_TYPES.join(",")}
              className="sr-only"
              aria-label={t("note.upload_choose")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Allow selecting the same file again after an error
                event.target.value = "";
                if (file) void uploadFile(file, replaceNext.current);
              }}
              disabled={busy || uploading || offline}
            />
            <div className="relative flex items-center gap-3">
              {/* The tray: a small menu above the arrow, so opening it never moves or covers the note */}
              <div
                data-note-tray
                inert={!tools}
                className={cx(
                  "absolute bottom-full left-0 mb-3 w-max min-w-64 origin-bottom-left rounded-3xl border border-separator bg-surface-elevated p-2 shadow-lg transition-[opacity,scale,translate] duration-150 ease-out motion-reduce:transition-none",
                  tools
                    ? "translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none translate-y-1 scale-95 opacity-0",
                )}
              >
                {canDictate() && (
                  <TrayItem
                    icon={<MicIcon size={18} />}
                    label={t("note.mic")}
                    disabled={busy || offline}
                    onClick={() => withMode(startDictation)}
                  />
                )}
                <TrayItem
                  icon={<PaperclipIcon size={18} />}
                  label={t("note.upload_file")}
                  disabled={busy || uploading || offline || !!attachment}
                  onClick={() =>
                    withMode((replace) => {
                      setTools(false);
                      replaceNext.current = replace;
                      fileInputRef.current?.click();
                    })
                  }
                />
                {offline && (
                  <p className="m-0 px-2 pt-1 pb-1.5 text-footnote text-ink-tertiary">
                    {t("note.file_offline")}
                  </p>
                )}
              </div>
              <IconButton
                data-note-tray
                className="size-11! min-h-11! shrink-0 bg-fill!"
                label={t("note.tools")}
                aria-expanded={tools}
                icon={
                  <ChevronUpIcon
                    className={cx(
                      "transition-transform duration-200 motion-reduce:transition-none",
                      tools && "rotate-180",
                    )}
                  />
                }
                onClick={() => setTools((open) => !open)}
              />
              {uploading || busy ? (
                <Button
                  size="lg"
                  className="bar-sweep flex-1"
                  onClick={() =>
                    uploading ? uploadAbort.current?.abort() : cancelSubmit()
                  }
                >
                  <span className="link-swipe">{t("common.cancel")}</span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className={cx("flex-1", busy && "bar-sweep")}
                  busy={busy}
                  disabled={!canSubmit}
                  onClick={() => submit()}
                >
                  <SparklesIcon size={18} />
                  {t(
                    note
                      ? "note.replan"
                      : offline
                        ? "note.save_offline"
                        : "note.make_tasks",
                  )}
                </Button>
              )}
            </div>
          </div>
          {dictating && (
            <DictationSheet
              offline={offline}
              onClose={() => setDictating(false)}
              onWords={insertWords}
            />
          )}
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
        open={!!choosing}
        history={false}
        title={t("note.replace_title")}
        onClose={() => setChoosing(null)}
        actionsLayout="row"
        actions={
          <>
            <Button onClick={() => choose(false)}>
              {t("note.add_action")}
            </Button>
            <Button variant="primary" onClick={() => choose(true)}>
              {t("note.replace_action")}
            </Button>
          </>
        }
      />
      <Dialog
        open={removingFile}
        history={false}
        title={t("note.file_remove_title")}
        onClose={() => setRemovingFile(false)}
        actionsLayout="row"
        actions={
          <>
            <Button onClick={() => removeFile(false)}>
              {t("note.file_keep_text")}
            </Button>
            <Button variant="destructive" onClick={() => removeFile(true)}>
              {t("note.file_remove_text")}
            </Button>
          </>
        }
      />
      <Dialog
        open={confirming}
        history={false}
        title={t(note ? "note.discard_edit_title" : "note.discard_title")}
        description={t(note ? "note.discard_edit_body" : "note.discard_body")}
        onClose={() => setConfirming(false)}
        actionsLayout="row"
        actions={
          <>
            <Button onClick={() => setConfirming(false)}>
              {t("common.keep_editing")}
            </Button>
            <Button variant="destructive" onClick={discard}>
              {t("common.discard_action")}
            </Button>
          </>
        }
      />
    </>
  );
}
