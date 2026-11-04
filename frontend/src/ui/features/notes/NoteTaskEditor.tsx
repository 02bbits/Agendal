import { useEffect, useId, useRef, useState } from "react";
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

/** A proposed task is a local form: Cancel discards it, Done updates only the waiting plan. */
export function NoteTaskEditor({
  task,
  onCancel,
  onDone,
  onOmit,
  weekStart,
  creating = true,
}: {
  task: Task;
  onCancel: () => void;
  onDone: (patch: TaskPatch) => void;
  onOmit: () => void;
  weekStart: "mon" | "sun";
  creating?: boolean;
}) {
  const store = useTaskStore();
  const wide = useMediaQuery("(min-width: 1280px)");
  const [draft, setDraft] = useState(task);
  const changes = useRef<TaskPatch>({});
  const [error, setError] = useState<CopyKey | null>(null);
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = useId();
  useHistoryEntry(!wide, onCancel);
  useModalFocus(root, heading, true, onCancel);
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
      role={wide ? "region" : "dialog"}
      aria-modal={wide ? undefined : true}
      aria-labelledby={title}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-paper md:left-[248px] xl:absolute xl:inset-0 xl:z-10"
    >
      <header className="sticky top-0 z-10 grid min-h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-paper px-4 pt-[env(safe-area-inset-top)]">
        <button
          className="focus-ring min-h-11 justify-self-start rounded-field px-2 text-body"
          onClick={onCancel}
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
          className="focus-ring min-h-11 justify-self-end rounded-field px-2 font-semibold disabled:opacity-40"
          disabled={!draft.title.trim() || !!error}
          onClick={() =>
            onDone({ ...changes.current, title: draft.title.trim() })
          }
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
    </section>
  );
}
