import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { cx } from "../../components/cx";
import { PencilIcon } from "../../components/icons";
import { NavBar } from "../../components/NavBar";
import { t, tc } from "../../copy";
import {
  addDays,
  formatDay,
  formatTime,
  startOfWeek,
} from "../../domain/dates";
import { localDateTime } from "../../domain/edit";
import type {
  NoteChange,
  NoteResult as NoteResultData,
  Task,
  TimeFormat,
  WeekStart,
} from "../../domain/types";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";

interface ClarificationHandler {
  (text: string): Promise<void>;
}

export interface NoteResultScreenProps {
  result: NoteResultData;
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
  /** A When? chip, or the picked date, sets this task's due date (Q4). */
  onSetDue: (task: Task, date: string) => void;
  onClarify?: ClarificationHandler;
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
const nameOf = (result: NoteResultData) =>
  result.note.name ?? result.note.text.split(/\s+/).slice(0, 6).join(" ");

const LONG_QUOTE = 160;

/**
 * Result screen (RV-1): what a note did. The name, the note quoted, and one row per created,
 * updated or deleted task. Created and updated rows open Task details; a created task with no
 * date offers When? chips. Undo all and Edit note come with IM-44 and IM-47.
 */
export function NoteResultScreen({
  result,
  live = {},
  today,
  timeZone,
  timeFormat,
  weekStart,
  onDone,
  onSetDue,
  onClarify,
  navigate,
}: NoteResultScreenProps) {
  const overlineId = useId();
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [expanded, setExpanded] = useState(false);
  // A11Y-20, UX-61: focus goes to the heading, whose name includes the overline
  useEffect(
    () => heading.current?.focus(),
    [result.note.status, result.note.processed_at],
  );

  const { note, changes, skipped } = result;
  const processingUnavailable = result.processing?.some(
    (item) => item.source === "pending",
  );
  const written = localDateTime(note.processed_at, timeZone);
  const count = (kind: NoteChange["kind"]) =>
    changes.filter((change) => change.kind === kind).length;
  const created = count("created");
  const updated = count("updated");
  const deleted = count("deleted");
  const overline = [
    `${formatDay(written.date, today)} ${formatTime(written.time, timeFormat)}`,
    created > 0 && tc("note.made", created),
    updated > 0 && t("note.overline_updated", { count: updated }),
    deleted > 0 && t("note.overline_deleted", { count: deleted }),
  ]
    .filter(Boolean)
    .join(" · ");
  const longQuote =
    note.text.length > LONG_QUOTE || note.text.split("\n").length > 4;

  return (
    <div className="pb-8">
      <NavBar backLabel={t("common.back")} onBack={onDone} />

      <p
        id={overlineId}
        className="m-0 text-overline font-semibold uppercase text-ink-secondary"
      >
        {overline}
      </p>
      <h1
        ref={heading}
        id={titleId}
        tabIndex={-1}
        aria-labelledby={`${overlineId} ${titleId}`}
        className="mt-1 mb-0 text-display font-bold focus:outline-none"
      >
        {note.status === "followup"
          ? t(
              processingUnavailable
                ? "note.processing_unavailable"
                : "note.clarify_question",
            )
          : nameOf(result)}
      </h1>
      {note.source_file_name && (
        <p className="mt-2 mb-0 text-footnote text-ink-secondary">
          {t("note.from_file", { file_name: note.source_file_name })}
        </p>
      )}

      <blockquote className="my-4 border-l-2 border-separator pl-3 text-note text-ink-secondary">
        <p
          className={cx("m-0 whitespace-pre-line", !expanded && "line-clamp-4")}
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
        <ul className="m-0 list-none overflow-hidden rounded-box bg-surface p-0">
          {changes.map((change) => (
            <ChangeRow
              key={`${change.kind}-${change.task.id}`}
              change={change}
              current={live[change.task.id]}
              today={today}
              weekStart={weekStart}
              onSetDue={onSetDue}
              navigate={navigate}
            />
          ))}
        </ul>
      )}

      {skipped.length > 0 && (
        <section className="mt-6">
          <h2 className="mt-0 mb-2 text-overline font-semibold uppercase text-ink-secondary">
            {t("note.skipped")}
          </h2>
          <ul className="m-0 list-none p-0 text-footnote text-ink-secondary">
            {skipped.map((item) => (
              <li key={item.ref} className="py-1">
                {item.reason === "unclear"
                  ? t("note.skip_unclear", { text: item.text })
                  : item.reason === "already_done"
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

      {note.status === "followup" && (
        <ClarificationForm
          key={note.processed_at}
          text={note.text}
          onClarify={onClarify}
        />
      )}

      {changes.length > 0 && (
        <p className="mt-4 mb-0 text-footnote text-ink-secondary">
          {t("note.result_hint")}
        </p>
      )}

      {note.status !== "followup" && (
        <div className="sticky bottom-0 mt-6 bg-paper pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Button variant="primary" size="lg" fullWidth onClick={onDone}>
            {t("common.done")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ClarificationForm({
  text,
  onClarify,
}: {
  text: string;
  onClarify?: ClarificationHandler;
}) {
  const id = useId();
  const [answer, setAnswer] = useState(text);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <form
      className="mt-6 space-y-3"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !onClarify || !answer.trim()) return;
        setBusy(true);
        setFailed(false);
        try {
          await onClarify(answer.trim());
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p id={`${id}-hint`} className="text-footnote text-ink-secondary">
        {t("note.clarify_hint")}
      </p>
      <label htmlFor={id} className="block font-semibold">
        {t("note.clarify_label")}
      </label>
      <textarea
        id={id}
        aria-describedby={`${id}-hint`}
        className="focus-ring min-h-32 w-full rounded-box border border-separator bg-surface p-3 text-ink"
        maxLength={5000}
        required
        value={answer}
        disabled={busy}
        onChange={(event) => setAnswer(event.target.value)}
      />
      {failed && (
        <p role="alert" className="text-footnote text-error">
          {t("note.send_failed")}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        fullWidth
        busy={busy}
        disabled={busy || !onClarify || !answer.trim()}
      >
        {t("note.clarify_submit")}
      </Button>
    </form>
  );
}

interface ChangeRowProps {
  change: NoteChange;
  current: Task | null | undefined;
  today: string;
  weekStart: WeekStart;
  onSetDue: (task: Task, date: string) => void;
  navigate?: Navigate;
}

function ChangeRow({
  change,
  current,
  today,
  weekStart,
  onSetDue,
  navigate,
}: ChangeRowProps) {
  const badge = BADGE[change.kind];
  const badgeText = t(badge.key);
  const task = current ?? change.task;
  // Gone: removed since by hand or by another note (RV-E13). A deleted row never opens
  const gone = current === null;
  const opens = change.kind !== "deleted" && !gone;

  // A date given from here (When? chip) shows in front of what the note said
  const meta = gone
    ? t("note.gone_since")
    : [
        change.task.due_date === null &&
          task.due_date &&
          formatDay(task.due_date, today),
        change.label,
        change.was && t("note.was", { value: change.was }),
      ]
        .filter(Boolean)
        .join(" · ");
  const askWhen = change.kind === "created" && !gone && !task.due_date;

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
        <PencilIcon size={18} aria-hidden="true" className="mt-1 shrink-0" />
      )}
    </>
  );

  return (
    <li className="border-b border-separator last:border-b-0">
      {opens ? (
        <Link
          href={ROUTES.task(task.id)}
          navigate={navigate}
          aria-label={`${sentence(badgeText)}: ${task.title}, ${meta}`}
          className="focus-ring flex min-h-[52px] items-start gap-3 px-3.5 py-3 text-ink no-underline"
        >
          {body}
        </Link>
      ) : (
        <div
          className={cx(
            "flex min-h-[52px] items-start gap-3 px-3.5 py-3",
            gone && "opacity-60",
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
