import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { cx } from "../../components/cx";
import { Dialog } from "../../components/Dialog";
import { IconButton } from "../../components/IconButton";
import { PencilIcon, TrashIcon } from "../../components/icons";
import { NavBar } from "../../components/NavBar";
import { t, tc } from "../../copy";
import {
  addDays,
  formatDay,
  formatTime,
  startOfWeek,
  undoExpired,
} from "../../domain/dates";
import { localDateTime } from "../../domain/edit";
import type {
  NoteChange,
  NoteResult as NoteResultData,
  Task,
  TimeFormat,
  WeekStart,
  Project,
} from "../../domain/types";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";

export interface NoteResultScreenProps {
  result: NoteResultData;
  presentation?: "screen" | "panel";
  projects?: Project[];
  omittedCount?: number;
  /**
   * The tasks as they are now, by id. `null` means the task was removed since the note made its
   * change (RV-E13). A task that isn't listed is taken as the note left it.
   */
  live?: Readonly<Record<string, Task | null>>;
  today: string;
  timeZone: string;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  onDone: () => void;
  onRestoreOmission?: () => void;
  /** Check this first (`confirm`): Apply changes, and Edit note (NU-5, WF-02). */
  onApply?: () => void;
  onEdit?: () => void;
  onMakeTask?: () => void;
  /** Renames the note; resolves `false` when it couldn't be saved, so the field stays open. */
  onRename?: (name: string) => Promise<boolean>;
  /** Deletes the note once the user confirms; the screen is left by the caller. */
  onDelete?: () => Promise<void> | void;
  /** Apply or Edit note is waiting on the server. */
  busy?: boolean;
  /** No connection: Apply, Edit note and Undo all can't reach the server (RV §2.4). */
  offline?: boolean;
  /** Check this first: a row opens Task details on the planned task. */
  onOpenTask?: (task: Task) => void;
  /** Undo all (RV-2). `true` once the user has confirmed the conflict dialog. */
  onUndo?: (confirmConflicts: boolean) => void;
  /** How many created tasks were edited since: shows the confirm dialog (RV §2.4). 0 = none */
  conflicts?: number;
  onCancelUndo?: () => void;
  /** A When? chip, or the picked date, sets this task's due date (Q4). */
  onSetDue: (task: Task, date: string) => void;
  navigate?: Navigate;
}

const BADGE = {
  created: { key: "note.badge_created", tone: "bg-success-tint text-success" },
  updated: { key: "note.badge_updated", tone: "bg-fill text-ink" },
  deleted: { key: "note.badge_deleted", tone: "bg-danger-tint text-error" },
} as const;

// "CREATED" → "Created", for the row's accessible name (A11Y-21)
const sentence = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

// The note's name, or its first words while it has none
export const nameOf = (result: NoteResultData) =>
  result.note.name ?? result.note.text.split(/\s+/).slice(0, 6).join(" ");

const LONG_QUOTE = 160;

/**
 * Result screen (RV-1): what a note did. The name, the note quoted, and one row per created,
 * updated or deleted task. Created and updated rows open Task details; a created task with no
 * date offers When? chips. Undo all (IM-44) reverses the note; Edit note comes with IM-47.
 *
 * A `confirm` note shows the same rows as Check this first (NU-5): what applying will do. A row
 * opens Task details on the planned task, and the footer has Edit note and Apply changes.
 */
export function NoteResultScreen({
  result,
  presentation = "screen",
  projects = [],
  omittedCount = 0,
  onRestoreOmission,
  live = {},
  today,
  timeZone,
  timeFormat,
  weekStart,
  onDone,
  onApply,
  onEdit,
  onMakeTask,
  onRename,
  onDelete,
  busy = false,
  offline = false,
  onOpenTask,
  onUndo,
  conflicts = 0,
  onCancelUndo,
  onSetDue,
  navigate,
}: NoteResultScreenProps) {
  const overlineId = useId();
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Renaming: the field's text while open. Enter or leaving the field saves, Escape cancels
  const [naming, setNaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const saveName = async () => {
    const name = naming?.trim();
    if (!name || name === nameOf(result)) return setNaming(null);
    if (await onRename!(name)) setNaming(null);
  };
  // A11Y-20, UX-61: focus goes to the heading, whose name includes the overline
  useEffect(() => heading.current?.focus(), []);

  const { note, changes, skipped } = result;
  const Heading = presentation === "panel" ? "h2" : "h1";
  const deleteDialog = (
    <Dialog
      open={deleting}
      title={t("note.delete_title", { name: nameOf(result) })}
      description={t("note.delete_body")}
      onClose={() => setDeleting(false)}
      actions={
        <>
          <Button onClick={() => setDeleting(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setDeleting(false);
              await onDelete?.();
            }}
          >
            {t("common.delete")}
          </Button>
        </>
      }
    />
  );
  if (note.status === "followup")
    return (
      <div
        className={cx(
          "flex flex-col",
          presentation === "panel" ? "min-h-[calc(100dvh-72px)]" : "min-h-dvh",
        )}
      >
        {presentation === "screen" && (
          <NavBar backLabel={t("common.back")} onBack={onDone} />
        )}
        <div className="mt-1 flex items-start gap-2">
          <Heading
            ref={heading}
            tabIndex={-1}
            className="m-0 min-w-0 flex-1 text-display font-bold focus:outline-none"
          >
            {t("note.followup_title")}
          </Heading>
          {onDelete && (
            <IconButton
              plain
              label={t("note.delete")}
              icon={<TrashIcon size={18} />}
              disabled={offline}
              onClick={() => setDeleting(true)}
            />
          )}
        </div>
        <blockquote className="my-4 border-l-2 border-separator pl-3 text-note text-ink-secondary">
          <p className="m-0 whitespace-pre-line [overflow-wrap:anywhere]">
            {note.text}
          </p>
        </blockquote>
        <div className="sticky bottom-0 mt-auto flex flex-col gap-3 bg-paper pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {offline && (
            <p className="m-0 text-footnote text-ink-secondary">
              {t("note.needs_connection")}
            </p>
          )}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            disabled={offline || busy}
            onClick={onEdit}
          >
            {t("note.followup_edit")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={offline || busy}
            busy={busy}
            onClick={onMakeTask}
          >
            {t("note.make_one")}
          </Button>
        </div>
        {deleteDialog}
      </div>
    );
  const written = localDateTime(note.processed_at, timeZone);
  const count = (kind: NoteChange["kind"]) =>
    changes.filter((change) => change.kind === kind).length;
  const created = count("created");
  const updated = count("updated");
  const deleted = count("deleted");
  const confirming = note.status === "confirm";
  const undone = note.status === "pending";
  // RV-E2: after 30 days the note stays, but Undo all is gone
  const expired = undoExpired(written.date, today);
  const overline = confirming
    ? t("note.review_title")
    : [
        `${formatDay(written.date, today)} ${formatTime(written.time, timeFormat)}`,
        undone && t("notes.needs"),
        !undone && created > 0 && tc("note.made", created),
        !undone &&
          updated > 0 &&
          t("note.overline_updated", { count: updated }),
        !undone &&
          deleted > 0 &&
          t("note.overline_deleted", { count: deleted }),
      ]
        .filter(Boolean)
        .join(" · ");
  const longQuote =
    note.text.length > LONG_QUOTE || note.text.split("\n").length > 4;

  return (
    <div
      className={cx(
        "flex flex-col",
        presentation === "panel" ? "min-h-[calc(100dvh-72px)]" : "min-h-dvh",
      )}
    >
      {presentation === "screen" && (
        <NavBar backLabel={t("common.back")} onBack={onDone} />
      )}

      <p
        id={overlineId}
        className="m-0 text-overline font-semibold uppercase text-ink-secondary"
      >
        {overline}
      </p>
      {naming === null ? (
        <div className="mt-1 flex items-start gap-2">
          <Heading
            ref={heading}
            id={titleId}
            tabIndex={-1}
            aria-labelledby={`${overlineId} ${titleId}`}
            className="m-0 min-w-0 flex-1 text-display font-bold [overflow-wrap:anywhere] focus:outline-none"
          >
            {nameOf(result)}
          </Heading>
          {onRename && (
            <IconButton
              plain
              label={t("note.rename")}
              icon={<PencilIcon size={18} />}
              disabled={offline}
              onClick={() => setNaming(nameOf(result))}
            />
          )}
          {onDelete && (
            <IconButton
              plain
              label={t("note.delete")}
              icon={<TrashIcon size={18} />}
              disabled={offline}
              onClick={() => setDeleting(true)}
            />
          )}
        </div>
      ) : (
        <input
          autoFocus
          aria-label={t("note.name_label")}
          value={naming}
          onChange={(event) => setNaming(event.target.value)}
          onKeyDown={async (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setNaming(null);
            }
            if (event.key !== "Enter") return;
            event.preventDefault();
            await saveName();
          }}
          onBlur={saveName}
          className="focus-ring mt-1 w-full rounded-field border-0 bg-surface px-2 py-1 text-display font-bold text-ink"
        />
      )}
      {confirming && (
        <p className="mt-2 mb-0 text-callout text-ink-secondary">
          {tc("note.confirm_body", changes.length)}
        </p>
      )}
      {note.source_file_name && (
        <p className="mt-2 mb-0 text-footnote text-ink-secondary">
          {t("note.from_file", { file_name: note.source_file_name })}
        </p>
      )}

      <blockquote className="my-4 rounded-box bg-surface px-4 py-3 text-note text-ink">
        <p
          className={cx(
            "m-0 whitespace-pre-line [overflow-wrap:anywhere]",
            !expanded && "line-clamp-4",
          )}
        >
          {note.text}
        </p>
        {longQuote && (
          <button
            type="button"
            aria-expanded={expanded}
            className="focus-ring mt-1 cursor-pointer border-0 bg-transparent p-0 text-footnote font-medium text-primary underline underline-offset-2"
            onClick={() => setExpanded(!expanded)}
          >
            {t(expanded ? "note.show_less" : "note.show_all")}
          </button>
        )}
      </blockquote>

      {changes.length > 0 && (
        <section className="overflow-hidden rounded-box bg-surface">
          {confirming && (
            <p className="m-0 border-b border-separator px-4 pt-3 pb-2.5 text-overline font-semibold uppercase text-ink-secondary">
              {t("note.planned_count", { count: changes.length })}
            </p>
          )}
          <ul className="m-0 list-none p-0">
            {changes.map((change) => (
              <ChangeRow
                key={`${change.kind}-${change.task.id}`}
                change={change}
                current={live[change.task.id]}
                onOpen={
                  confirming || presentation === "panel"
                    ? onOpenTask
                    : undefined
                }
                undone={undone}
                today={today}
                timeFormat={timeFormat}
                weekStart={weekStart}
                onSetDue={onSetDue}
                navigate={navigate}
                preview={confirming}
                project={projects.find(
                  (project) =>
                    project.id ===
                    (live[change.task.id] ?? change.task).project_id,
                )}
              />
            ))}
          </ul>
        </section>
      )}

      {omittedCount > 0 && (
        <div className="my-3 text-footnote">
          <p className="m-0">{t("note.omitted", { count: omittedCount })}</p>
          <button
            className="focus-ring min-h-11 rounded-field px-2 text-primary hover:bg-fill"
            onClick={onRestoreOmission}
          >
            {t("note.undo_omit")}
          </button>
        </div>
      )}

      {skipped.length > 0 && (
        <section className="mt-6">
          <h2 className="mt-0 mb-2 text-overline font-semibold uppercase text-ink-secondary">
            {t("note.skipped")}
          </h2>
          <ul className="m-0 list-none p-0 text-footnote text-ink-secondary">
            {skipped.map((item) => (
              <li key={item.ref} className="py-1">
                {item.reason === "already_done"
                  ? t("note.skip_already_done", { title: item.text })
                  : item.reason === "not_found"
                    ? t("note.skip_not_found", { text: item.text })
                    : item.reason === "no_change"
                      ? t("note.skip_no_change", { title: item.text })
                      : item.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {changes.length > 0 && !confirming && (
        <p className="mt-4 mb-0 text-footnote text-ink-secondary">
          {t("note.result_hint")}
        </p>
      )}

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-paper pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {confirming ? (
          <>
            {offline && (
              <p className="mt-0 mb-3 text-footnote text-ink-secondary">
                {t("note.needs_connection")}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1"
                disabled={offline || busy}
                onClick={onEdit}
              >
                {t("note.edit")}
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={offline || busy || changes.length === 0}
                busy={busy}
                onClick={onApply}
              >
                {t("note.apply_preview")}
              </Button>
            </div>
          </>
        ) : (
          <>
            {note.status === "done" &&
              changes.length > 0 &&
              (expired ? (
                <p className="m-0 text-center text-footnote text-ink-secondary">
                  {t("note.undo_expired")}
                </p>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    disabled={offline}
                    onClick={() => onUndo?.(false)}
                  >
                    {t("note.undo_all")}
                  </Button>
                  {offline && (
                    <p className="m-0 text-center text-footnote text-ink-secondary">
                      {t("note.needs_connection")}
                    </p>
                  )}
                </>
              ))}
            <Button variant="primary" size="lg" fullWidth onClick={onDone}>
              {t(presentation === "panel" ? "common.close" : "common.done")}
            </Button>
          </>
        )}
      </div>

      {deleteDialog}

      <Dialog
        open={conflicts > 0}
        title={t("note.undo_conflict_title")}
        description={t("note.undo_conflict_body", { count: conflicts })}
        onClose={() => onCancelUndo?.()}
        actions={
          <>
            <Button variant="destructive" onClick={() => onUndo?.(true)}>
              {t("note.undo_all")}
            </Button>
            <Button variant="outline" onClick={() => onCancelUndo?.()}>
              {t("common.cancel")}
            </Button>
          </>
        }
      />
    </div>
  );
}

interface ChangeRowProps {
  preview?: boolean;
  project?: Project;
  change: NoteChange;
  current: Task | null | undefined;
  /** Check this first: the task isn't made yet, so the row opens it here instead of its page. */
  onOpen?: (task: Task) => void;
  /** The note was undone: rows stay as a record and stop opening (RV §2.1) */
  undone: boolean;
  today: string;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  onSetDue: (task: Task, date: string) => void;
  navigate?: Navigate;
}

function ChangeRow({
  preview = false,
  project,
  change,
  current,
  onOpen,
  undone,
  today,
  timeFormat,
  weekStart,
  onSetDue,
  navigate,
}: ChangeRowProps) {
  const badge = BADGE[change.kind];
  const badgeText =
    preview && change.kind === "created" ? t("note.preview_new") : t(badge.key);
  const task = current ?? change.task;
  // Gone: removed since by hand or by another note (RV-E13). A deleted row never opens
  const gone = current === null;
  const opens = change.kind !== "deleted" && !gone && !undone;

  // Rescheduled on Check this first: the new date and time replace what the note said
  const moved =
    onOpen !== undefined &&
    (task.due_date !== change.task.due_date ||
      task.start_time !== change.task.start_time);
  // A date given from here (When? chip) shows in front of what the note said
  const meta = preview
    ? [
        project?.name ?? t("project.none"),
        task.start_date &&
          [
            formatDay(task.start_date, today),
            task.start_time && formatTime(task.start_time, timeFormat),
          ]
            .filter(Boolean)
            .join(", "),
        task.due_date &&
          (task.due_date !== task.start_date || task.due_time) &&
          [
            formatDay(task.due_date, today),
            task.due_time && formatTime(task.due_time, timeFormat),
          ]
            .filter(Boolean)
            .join(", "),
        t(`priority.${task.priority ?? "low"}`),
        task.reminder !== "none" && t(`reminder.${task.reminder}`),
        task.repeat !== "never" && t(`repeat.${task.repeat}`),
      ]
        .filter(Boolean)
        .join(" · ")
    : gone
      ? t("note.gone_since")
      : moved
        ? [
            task.due_date ? formatDay(task.due_date, today) : t("task.no_date"),
            task.start_time && formatTime(task.start_time, timeFormat),
          ]
            .filter(Boolean)
            .join(" · ")
        : [
            change.task.due_date === null &&
              task.due_date &&
              formatDay(task.due_date, today),
            change.label,
            change.was && t("note.was", { value: change.was }),
          ]
            .filter(Boolean)
            .join(" · ");
  const askWhen =
    !preview && change.kind === "created" && !gone && !undone && !task.due_date;

  const body = (
    <>
      <span
        className={cx(
          "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-overline font-semibold",
          badge.tone,
        )}
      >
        {badgeText}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{task.title}</span>
        <span className="block text-footnote text-ink-secondary">{meta}</span>
      </span>
      {opens && (
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center self-center text-ink-secondary"
        >
          <PencilIcon size={18} />
        </span>
      )}
    </>
  );

  return (
    <li className="border-b border-separator last:border-b-0">
      {opens && onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(task)}
          aria-label={`${sentence(badgeText)}: ${task.title}, ${meta}`}
          className="focus-ring flex min-h-[52px] w-full cursor-pointer items-start gap-3 border-0 bg-transparent px-3.5 py-3 text-left text-ink hover:bg-fill"
        >
          {body}
        </button>
      ) : opens ? (
        <Link
          href={ROUTES.task(task.id)}
          navigate={navigate}
          aria-label={`${sentence(badgeText)}: ${task.title}, ${meta}`}
          className="focus-ring flex min-h-[52px] items-start gap-3 px-3.5 py-3 text-ink no-underline hover:bg-fill"
        >
          {body}
        </Link>
      ) : (
        <div
          className={cx(
            "flex min-h-[52px] items-start gap-3 px-3.5 py-3",
            (gone || undone) && "opacity-60",
          )}
        >
          {body}
        </div>
      )}
      {askWhen && (
        <WhenChips
          today={today}
          weekStart={weekStart}
          onPick={(date) => onSetDue(task, date)}
        />
      )}
    </li>
  );
}

/** Today, Tomorrow, Next week and Pick date… for a new task that has no date (Q4). */
function WhenChips({
  today,
  weekStart,
  onPick,
}: {
  today: string;
  weekStart: WeekStart;
  onPick: (date: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div
      role="group"
      aria-label={t("note.ask_when")}
      className="flex flex-wrap items-center gap-2 px-3.5 pb-3"
    >
      <span className="text-footnote font-medium text-ink-secondary">
        {t("note.ask_when")}
      </span>
      <Chip onClick={() => onPick(today)}>{t("date.today")}</Chip>
      <Chip onClick={() => onPick(addDays(today, 1))}>
        {t("date.tomorrow")}
      </Chip>
      <Chip onClick={() => onPick(startOfWeek(addDays(today, 7), weekStart))}>
        {t("task.next_week")}
      </Chip>
      <Chip selected={picking} onClick={() => setPicking(!picking)}>
        {t("task.pick_date")}
      </Chip>
      {picking && (
        <input
          type="date"
          aria-label={t("task.pick_date")}
          className="input focus-ring h-9 rounded-field border-control bg-surface px-2 text-footnote text-ink"
          autoFocus
          onChange={(event) => event.target.value && onPick(event.target.value)}
        />
      )}
    </div>
  );
}
