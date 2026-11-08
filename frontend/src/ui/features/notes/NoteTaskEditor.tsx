import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { useHistoryEntry } from "../../components/useHistoryEntry";
import { useMediaQuery } from "../../components/useMediaQuery";
import { useModalFocus } from "../../components/useModalFocus";
import { t, type CopyKey } from "../../copy";
import { normalizePatch, patchErrors } from "../../domain/edit";
import type { TaskPatch } from "../../domain/api";
import type { Task } from "../../domain/types";
import { useTaskStore } from "../tasks/store";
import { PriorityField } from "../tasks/details/PriorityField";
import { SettingsRows } from "../tasks/details/SettingsRows";
import { NotesField } from "../tasks/details/NotesField";
import { DiscardDialog } from "../tasks/new/DiscardDialog";

/** Set while the editor is open; `false` means it asked before dropping its draft and stays open. */
type CloseGuardRef = RefObject<(() => boolean) | null>;

/** A proposed task is a local form: Cancel discards it (asking first once edited), Done updates only the waiting plan. */
export function NoteTaskEditor({
  task,
  onCancel,
  onDone,
  onOmit,
  weekStart,
  creating = true,
  closeGuardRef,
}: {
  task: Task;
  onCancel: () => void;
  onDone: (patch: TaskPatch) => void;
  onOmit: () => void;
  weekStart: "mon" | "sun";
  creating?: boolean;
  /** Closing the screen around it (close button, backdrop, Back) asks this editor first */
  closeGuardRef?: CloseGuardRef;
}) {
  const store = useTaskStore();
  const wide = useMediaQuery("(min-width: 1280px)");
  const [draft, setDraft] = useState(task);
  const changes = useRef<TaskPatch>({});
  const [error, setError] = useState<CopyKey | null>(null);
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = useId();
  const [discarding, setDiscarding] = useState(false);
  // What differs from the planned task. normalizePatch drops a field set back to its old value,
  // and the title and notes are read as typed, before Done or a blur (UX-13)
  const edits = () =>
    normalizePatch(
      task,
      { ...changes.current, title: draft.title, notes: draft.notes },
      store.today,
    );
  // Cancel, Escape and Back ask before dropping edits (UX-13); `false` keeps Back's history entry.
  // With Discard? open, Back closes it first: that dialog has no history entry of its own
  const requestCancel = () => {
    if (discarding) {
      setDiscarding(false);
      return false;
    }
    if (Object.keys(edits()).length === 0) return onCancel();
    setDiscarding(true);
    return false;
  };
  useEffect(() => {
    if (!closeGuardRef) return;
    closeGuardRef.current = () => requestCancel() !== false;
    return () => {
      closeGuardRef.current = null;
    };
  });
  // Every width: on desktop the note panel follows the URL, so Back would close it past this draft
  useHistoryEntry(true, requestCancel);
  useModalFocus(root, heading, true, requestCancel);
  useEffect(() => {
    if (wide) heading.current?.focus();
  }, [wide]);
  const save = (raw: TaskPatch) => {
    const patch = normalizePatch(draft, raw, store.today);
    const errors = patchErrors(draft, patch);
    const message = Object.values(errors)[0];
    setError(message ?? null);
    if (message) return;
    changes.current = { ...changes.current, ...patch };
    setDraft({ ...draft, ...patch });
  };
  return (
    <section
      data-modal-host
      ref={root}
      // A modal layer at every width, so Escape reaches it through useModalFocus's layer order only:
      // a picker opened from it closes first, and the note panel under it waits
      role="dialog"
      aria-modal
      aria-labelledby={title}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-paper md:left-[248px] xl:absolute xl:inset-0 xl:z-10"
    >
      <header className="sticky top-0 z-10 grid min-h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-paper px-4 pt-[env(safe-area-inset-top)]">
        <button
          className="focus-ring min-h-11 justify-self-start rounded-field px-2 text-body hover:bg-fill"
          onClick={requestCancel}
        >
          {t("common.cancel")}
        </button>
        <h2
          ref={heading}
          tabIndex={-1}
          id={title}
          className="m-0 text-heading font-semibold focus:outline-none"
        >
          {t("note.edit_task")}
        </h2>
        <button
          className="focus-ring min-h-11 justify-self-end rounded-field px-2 font-semibold hover:bg-fill disabled:opacity-40 disabled:hover:bg-transparent"
          disabled={!draft.title.trim() || !!error}
          onClick={() => onDone(edits())}
        >
          {t("common.done")}
        </button>
      </header>
      <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col gap-5 px-5 py-4">
        <TextField
          label={t("task.title")}
          value={draft.title}
          maxLength={200}
          onChange={(event) => {
            setDraft({ ...draft, title: event.target.value });
            setError(null);
          }}
        />
        <PriorityField
          value={draft.priority ?? "low"}
          onChange={(priority) => save({ priority })}
          variant="screen"
        />
        <SettingsRows
          task={draft}
          projects={store.projects}
          todayDate={store.today}
          clock={store.clock}
          timeFormat={store.timeFormat}
          weekStart={weekStart}
          variant="screen"
          onSave={save}
        />
        <div>
          <label
            htmlFor="task-notes"
            className="mb-2 block text-footnote font-medium"
          >
            {t("task.notes")}
          </label>
          <NotesField
            value={draft.notes}
            onSave={(notes) => save({ notes })}
            onChange={(notes) => setDraft((current) => ({ ...current, notes }))}
            variant="screen"
          />
        </div>
        {error && (
          <p role="alert" className="m-0 text-footnote text-error">
            {t(error)}
          </p>
        )}
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-[600px] bg-paper px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button variant="destructive" fullWidth onClick={onOmit}>
          {t(creating ? "note.dont_add" : "note.skip_change")}
        </Button>
      </div>
      <DiscardDialog
        open={discarding}
        onDiscard={onCancel}
        onKeepEditing={() => setDiscarding(false)}
      />
    </section>
  );
}
