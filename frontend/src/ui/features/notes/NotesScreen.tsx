import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { LoadError } from "../../components/LoadError";
import { NotesIcon, SparklesIcon, PaperclipIcon } from "../../components/icons";
import { countText, t, tc } from "../../copy";
import { formatDay, formatLongDate, formatTime } from "../../domain/dates";
import { localDateTime } from "../../domain/edit";
import type { NoteFilter, NoteListEntry, TimeFormat } from "../../domain/types";
import { ScreenHeader } from "../shell/ScreenHeader";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";

// What a done note did: tasks made, else tasks changed (RV-4)
function taskCount({ counts }: NoteListEntry): {
  count: number;
  label: string;
} {
  if (counts.created > 0)
    return { count: counts.created, label: tc("note.made", counts.created) };
  const changed = counts.updated + counts.deleted;
  return {
    count: changed,
    label: t("note.overline_updated", { count: changed }),
  };
}

// One short line that never wraps: "Accepted · 2" or "Pending"; screen readers hear the full count
function StatusLine({ note }: { note: NoteListEntry }) {
  if (note.failed) return null;
  if (note.status === "pending")
    return <span className="text-ink-secondary">{t("note.waiting")}</span>;
  if (note.status !== "done")
    return <span className="text-warning">{t("notes.needs")}</span>;
  const { count, label } = taskCount(note);
  return (
    <span className="text-ink-secondary">
      {t("notes.made")}
      <span aria-hidden="true"> · {countText(count)}</span>
      <span className="sr-only">, {label}</span>
    </span>
  );
}

const ROW = "flex min-h-16 items-center gap-3 px-4 py-3 text-ink";

/**
 * Notes: the header and the All / Accepted / Pending chips stay put; only the list below them
 * loads, fails or shows (#168), like Inbox and Upcoming.
 */
export function NotesScreen({
  status,
  onRetry,
  notes,
  total,
  needs,
  filter,
  onFilter,
  onWriteNote,
  onReviveNote,
  selected,
  today,
  timeZone,
  timeFormat,
  accountInitial,
  navigate,
}: {
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  notes: NoteListEntry[];
  /** The summary line, from the last list that came; none before the first. */
  total?: number;
  needs?: number;
  filter: NoteFilter;
  onFilter: (filter: NoteFilter) => void;
  onWriteNote: () => void;
  /** Tap on a refused note: its text goes back to the editor. */
  onReviveNote: (id: string) => void;
  selected?: string | null;
  today: string;
  timeZone: string;
  timeFormat: TimeFormat;
  accountInitial: string;
  navigate: Navigate;
}) {
  const days = new Map<string, NoteListEntry[]>();
  for (const entry of notes) {
    const day = localDateTime(entry.written_at, timeZone).date;
    days.set(day, [...(days.get(day) ?? []), entry]);
  }
  return (
    <>
      <ScreenHeader
        overline={formatLongDate(today)}
        title={t("nav.notes")}
        accountInitial={accountInitial}
        navigate={navigate}
      >
        {total !== undefined && (
          <p className="mt-1 text-footnote text-ink-secondary">
            {t("notes.summary", {
              count: countText(total),
              needs: countText(needs ?? 0),
            })}
          </p>
        )}
      </ScreenHeader>
      <div
        className="my-4 flex flex-wrap gap-2"
        role="group"
        aria-label={t("nav.notes")}
      >
        {(
          [
            ["all", t("notes.all")],
            ["made", t("notes.made")],
            ["needs", t("notes.needs")],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            selected={filter === value}
            onClick={() => onFilter(value)}
          >
            {label}
          </Chip>
        ))}
      </div>
      {status === "loading" && (
        <div
          role="status"
          aria-busy="true"
          aria-label={t("nav.notes")}
          className="h-80 w-full animate-pulse rounded-box bg-surface"
        />
      )}
      {status === "error" && <LoadError onRetry={onRetry} />}
      {status === "ready" && notes.length === 0 && (
        <div className="flex flex-col items-start gap-4 py-8">
          <p className="text-body text-ink-secondary">{t("note.list_empty")}</p>
          {filter === "all" && (
            <Button variant="primary" onClick={onWriteNote}>
              {t("note.capture_open")}
            </Button>
          )}
        </div>
      )}
      {status === "ready" &&
        [...days].map(([day, rows]) => (
          <section key={day} className="mb-5">
            <h2 className="mb-3 text-heading font-semibold">
              {formatDay(day, today)}{" "}
              <span className="text-ink-secondary">{rows.length}</span>
            </h2>
            <ul className="m-0 list-none divide-y divide-separator overflow-hidden rounded-box bg-surface p-0">
              {rows.map((note) => {
                const Icon = note.source_file_name
                  ? PaperclipIcon
                  : note.status === "done"
                    ? SparklesIcon
                    : NotesIcon;
                const row = (
                  <>
                    <Icon size={19} className="text-ink-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {note.name ?? note.excerpt.slice(0, 60)}
                        {note.edited_at && (
                          <span className="font-normal text-ink-secondary">
                            {" · "}
                            {t("note.edited_label")}
                          </span>
                        )}
                      </span>
                      <span
                        className={`line-clamp-2 text-footnote ${note.failed ? "text-warning" : "text-ink-secondary"}`}
                      >
                        {note.failed
                          ? t("note.couldnt_process")
                          : note.source_file_name
                            ? t("note.from_file", {
                                file_name: note.source_file_name,
                              })
                            : note.excerpt}
                      </span>
                    </span>
                    <span className="shrink-0 text-footnote whitespace-nowrap">
                      <StatusLine note={note} />
                    </span>
                    <time
                      dateTime={note.written_at}
                      className="shrink-0 text-footnote text-ink-secondary"
                    >
                      {formatTime(
                        localDateTime(note.written_at, timeZone).time,
                        timeFormat,
                      )}
                    </time>
                  </>
                );
                return (
                  <li key={note.id}>
                    {note.failed ? (
                      // Refused by the server: tap puts its text back in the editor (NU §3)
                      <button
                        type="button"
                        onClick={() => onReviveNote(note.id)}
                        className={`${ROW} focus-ring row-hover w-full cursor-pointer border-0 bg-transparent text-left`}
                      >
                        {row}
                      </button>
                    ) : note.status === "pending" ? (
                      // Nothing on the server to open yet (NC-6)
                      <div className={ROW}>{row}</div>
                    ) : (
                      <Link
                        href={ROUTES.note(note.id)}
                        navigate={navigate}
                        aria-current={selected === note.id ? "true" : undefined}
                        className={`${ROW} focus-ring no-underline row-hover ${selected === note.id ? "bg-surface-hover/60" : ""}`}
                      >
                        {row}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </>
  );
}
