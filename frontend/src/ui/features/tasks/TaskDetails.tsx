import { useId, useState, type ReactNode } from "react";
import { t, type CopyKey } from "../../copy";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  FlagIcon,
  FolderIcon,
  NotesIcon,
  RepeatIcon,
  SparklesIcon,
} from "../../components/icons";
import { NavBar } from "../../components/NavBar";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/TextField";
import type { TaskPatch } from "../../domain/api";
import { formatDay, formatTimeRange } from "../../domain/dates";
import {
  localDateTime,
  reminderAt,
  scheduleError,
  NOTES_MAX,
  TITLE_MAX,
} from "../../domain/edit";
import {
  PRIORITIES,
  REMINDERS,
  REPEATS,
  type Priority,
  type Reminder,
  type Repeat,
  type Task,
} from "../../domain/types";
import { Link } from "../shell/Link";
import type { Navigate } from "../shell/routes";
import { ChoiceSheet } from "./ChoiceSheet";
import { useTaskStore } from "./store";

const NO_PROJECT = "__none__";
const NEW_PROJECT = "__new__";
type Editor =
  | "due"
  | "schedule"
  | "reminder"
  | "repeat"
  | "priority"
  | "project"
  | "notes"
  | null;

export interface TaskDetailsProps {
  task: Task;
  onBack: () => void;
  navigate?: Navigate;
  /** "Created by the assistant · From note: {name}" for assistant tasks (NU-7). */
  sourceNote?: { name: string; href: string };
  /** "New project…" in the picker opens the PJ sheet (TK-E14). */
  onNewProject?: () => void;
  /** Delete task (IM-25). */
  deleteAction?: ReactNode;
}

function PropertyRow({
  icon,
  label,
  value,
  onClick,
  disabled,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
  helper?: string;
}) {
  const helperId = useId();
  return (
    <>
      <button
        type="button"
        className="focus-ring cursor-pointer bg-transparent disabled:cursor-default disabled:opacity-40 flex min-h-11 w-full items-center gap-3 border-b border-separator py-1 text-left text-body text-ink"
        onClick={onClick}
        disabled={disabled}
        aria-describedby={helper ? helperId : undefined}
      >
        <span
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-tile bg-fill text-ink-secondary"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex-1">{label}</span>
        <span className="text-ink-secondary">{value}</span>
        <ChevronRightIcon size={18} className="shrink-0 text-ink-tertiary" />
      </button>
      {helper && (
        <p
          id={helperId}
          className="mt-1 mb-2 ml-10 text-footnote text-ink-secondary"
        >
          {helper}
        </p>
      )}
    </>
  );
}

/** Task details (TK-2, TK-3): every field saves on change; there is no Save button. */
export function TaskDetails({
  task,
  onBack,
  navigate,
  sourceNote,
  onNewProject,
  deleteAction,
}: TaskDetailsProps) {
  const store = useTaskStore();
  const [editor, setEditor] = useState<Editor>(null);
  const [title, setTitle] = useState(task.title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const project = store.projectOf(task);
  const close = () => setEditor(null);
  const save = (patch: TaskPatch) => store.update(task, patch);

  const saveTitle = () => {
    if (!title.trim()) {
      setTitle(task.title);
      setTitleError(t("task.title_required"));
      return;
    }
    setTitleError(null);
    save({ title });
  };

  const due = task.due_date
    ? formatDay(task.due_date, store.today)
    : t("task.no_date");
  const schedule = task.start_time
    ? formatTimeRange(task.start_time, task.end_time, store.timeFormat)
    : t("task.not_set");
  const fires = reminderAt(task);
  const reminderHelper = !task.due_date
    ? t("task.reminder_needs_date")
    : fires && fires < localDateTime(store.clock.now(), store.clock.timeZone)
      ? t("task.reminder_past")
      : undefined;

  return (
    <div className="pb-8">
      <NavBar backLabel={t("common.back")} onBack={onBack} />

      <div className="mt-2 flex items-start gap-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={t(task.done ? "task.reopen" : "task.complete", {
            title: task.title,
          })}
          className={cx(
            "group/check mt-1 -ml-[11px] inline-flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-paper focus-visible:outline-none",
            task.done && "is-done",
          )}
          onClick={() => store.toggle(task)}
        >
          <span
            className="inline-flex size-[22px] items-center justify-center rounded-full shadow-[inset_0_0_0_2px_var(--color-ink-tertiary)] group-[.is-overdue]/task:shadow-[inset_0_0_0_2px_var(--color-error)] group-aria-checked/check:bg-ink group-aria-checked/check:shadow-none group-focus-visible/check:outline-2 group-focus-visible/check:outline-offset-2 group-focus-visible/check:outline-primary"
            aria-hidden="true"
          >
            {task.done && <CheckIcon size={14} strokeWidth={2.5} />}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="task-title">
            {t("task.title")}
          </label>
          <textarea
            id="task-title"
            className="focus-ring w-full resize-none rounded-tile border-0 bg-transparent py-1 font-serif text-title font-semibold text-ink [field-sizing:content]"
            rows={1}
            maxLength={TITLE_MAX}
            value={title}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "task-title-error" : undefined}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
          {titleError && (
            <p
              id="task-title-error"
              className="m-0 text-footnote text-error"
              role="alert"
            >
              {titleError}
            </p>
          )}
        </div>
      </div>
      {task.created_by === "assistant" && (
        <p className="mt-1 ml-10 flex flex-wrap items-center gap-1 text-footnote text-ink-secondary">
          <SparklesIcon size={13} />
          <span>{t("task.created_by_assistant")}</span>
          {sourceNote && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={sourceNote.href}
                navigate={navigate}
                className="focus-ring rounded text-primary underline underline-offset-2"
              >
                {t("task.from_note", { name: sourceNote.name })}
              </Link>
            </>
          )}
        </p>
      )}

      <h2 className="overline mt-6 mb-2 text-ink-secondary">
        {t("task.section_when")}
      </h2>
      <div className="flex flex-col">
        <PropertyRow
          icon={<CalendarIcon size={15} />}
          label={t("task.due")}
          value={due}
          onClick={() => setEditor("due")}
        />
        <PropertyRow
          icon={<ClockIcon size={15} />}
          label={t("task.schedule")}
          value={schedule}
          onClick={() => setEditor("schedule")}
        />
        <PropertyRow
          icon={<BellIcon size={15} />}
          label={t("task.reminder")}
          value={t(`reminder.${task.reminder}` as CopyKey)}
          onClick={() => setEditor("reminder")}
          disabled={!task.due_date}
          helper={reminderHelper}
        />
        <PropertyRow
          icon={<RepeatIcon size={15} />}
          label={t("task.repeat")}
          value={t(`repeat.${task.repeat}` as CopyKey)}
          onClick={() => setEditor("repeat")}
        />
      </div>

      <h2 className="overline mt-6 mb-2 text-ink-secondary">
        {t("task.section_details")}
      </h2>
      <div className="flex flex-col">
        <PropertyRow
          icon={<FlagIcon size={15} />}
          label={t("task.priority")}
          value={t(`priority.${task.priority}` as CopyKey)}
          onClick={() => setEditor("priority")}
        />
        <PropertyRow
          icon={<FolderIcon size={15} />}
          label={t("task.project")}
          value={project ? project.name : t("project.none")}
          onClick={() => setEditor("project")}
        />
        <PropertyRow
          icon={<NotesIcon size={15} />}
          label={t("task.notes")}
          value={task.notes ? task.notes.split("\n")[0]! : t("task.notes_add")}
          onClick={() => setEditor("notes")}
        />
      </div>

      {deleteAction && <div className="mt-6">{deleteAction}</div>}
      <p className="mt-3 text-center text-footnote text-ink-secondary">
        {t("task.created", {
          date: formatDay(task.created_at.slice(0, 10), store.today),
        })}{" "}
        · {t("task.saves_as_you_go")}
      </p>

      <div className="sticky bottom-0 mt-6 bg-paper pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => store.toggle(task)}
        >
          <CheckIcon size={18} />
          {t(task.done ? "task.mark_open" : "task.mark_done")}
        </Button>
      </div>

      {editor === "due" && (
        <DueSheet open task={task} onClose={close} onSave={save} />
      )}
      {editor === "schedule" && (
        <ScheduleSheet open task={task} onClose={close} onSave={save} />
      )}
      <ChoiceSheet<Reminder>
        open={editor === "reminder"}
        title={t("task.reminder")}
        value={task.reminder}
        choices={REMINDERS.map((r) => ({
          value: r,
          label: t(`reminder.${r}` as CopyKey),
        }))}
        onChoose={(reminder) => save({ reminder })}
        onClose={close}
      />
      <ChoiceSheet<Repeat>
        open={editor === "repeat"}
        title={t("task.repeat")}
        value={task.repeat}
        choices={REPEATS.map((r) => ({
          value: r,
          label: t(`repeat.${r}` as CopyKey),
        }))}
        onChoose={(repeat) => save({ repeat })}
        onClose={close}
      />
      <ChoiceSheet<Priority>
        open={editor === "priority"}
        title={t("task.priority")}
        value={task.priority}
        choices={PRIORITIES.map((p) => ({
          value: p,
          label: t(`priority.${p}` as CopyKey),
        }))}
        onChoose={(priority) => save({ priority })}
        onClose={close}
      />
      <ChoiceSheet<string>
        open={editor === "project"}
        title={t("task.project")}
        value={task.project_id ?? NO_PROJECT}
        choices={[
          {
            value: NO_PROJECT,
            label: t("project.none"),
            marker: (
              <span
                className="mr-0.5 inline-block size-2 shrink-0 rounded-full"
                style={{ background: "var(--color-project-gray)" }}
              />
            ),
          },
          ...store.projects.map((p) => ({
            value: p.id,
            label: p.name,
            marker: (
              <span
                className="mr-0.5 inline-block size-2 shrink-0 rounded-full"
                style={{ background: `var(--color-project-${p.colour})` }}
              />
            ),
          })),
          ...(onNewProject
            ? [{ value: NEW_PROJECT, label: t("task.new_project") }]
            : []),
        ]}
        onChoose={(id) =>
          id === NEW_PROJECT
            ? onNewProject?.()
            : save({ project_id: id === NO_PROJECT ? null : id })
        }
        onClose={close}
      />
      {editor === "notes" && (
        <NotesSheet open task={task} onClose={close} onSave={save} />
      )}
    </div>
  );
}

type SheetEditorProps = {
  open: boolean;
  task: Task;
  onClose: () => void;
  onSave: (patch: TaskPatch) => unknown;
};

function DueSheet({ open, task, onClose, onSave }: SheetEditorProps) {
  const [value, setValue] = useState(task.due_date ?? "");
  return (
    <Sheet
      open={open}
      title={t("task.due")}
      closeLabel={t("common.close")}
      confirmLabel={t("common.done")}
      onConfirm={() => {
        onSave({ due_date: value || null });
        onClose();
      }}
      onClose={onClose}
    >
      <TextField
        label={t("task.due")}
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        variant="secondary"
        className="mt-4 w-full"
        disabled={!task.due_date}
        onClick={() => {
          onSave({ due_date: null });
          onClose();
        }}
      >
        {t("common.clear")}
      </Button>
    </Sheet>
  );
}

function ScheduleSheet({ open, task, onClose, onSave }: SheetEditorProps) {
  const [start, setStart] = useState(task.start_time ?? "");
  const [end, setEnd] = useState(task.end_time ?? "");
  const [showError, setShowError] = useState(false);
  const error = scheduleError(start || null, end || null);
  return (
    <Sheet
      open={open}
      title={t("task.schedule")}
      closeLabel={t("common.close")}
      confirmLabel={t("common.done")}
      onConfirm={() => {
        if (error) {
          setShowError(true);
          return;
        }
        onSave({
          start_time: start || null,
          end_time: start ? end || null : null,
        });
        onClose();
      }}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t("task.start")}
          type="time"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            if (!e.target.value) setEnd("");
          }}
        />
        <TextField
          label={t("task.end")}
          type="time"
          value={end}
          disabled={!start}
          onChange={(e) => setEnd(e.target.value)}
          onBlur={() => setShowError(true)}
          error={showError && error ? t(error) : undefined}
        />
      </div>
    </Sheet>
  );
}

function NotesSheet({ open, task, onClose, onSave }: SheetEditorProps) {
  const [value, setValue] = useState(task.notes ?? "");
  return (
    <Sheet
      open={open}
      title={t("task.notes")}
      closeLabel={t("common.close")}
      confirmLabel={t("common.done")}
      onConfirm={() => {
        onSave({ notes: value });
        onClose();
      }}
      onClose={onClose}
    >
      <label className="sr-only" htmlFor="task-notes">
        {t("task.notes")}
      </label>
      <textarea
        id="task-notes"
        className="textarea focus-ring min-h-[140px] w-full resize-y rounded-field border-control bg-surface px-4 py-3 text-body text-ink"
        rows={6}
        maxLength={NOTES_MAX}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Sheet>
  );
}
