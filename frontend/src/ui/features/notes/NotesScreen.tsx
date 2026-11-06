import { Chip } from "../../components/Chip";
import { NotesIcon, SparklesIcon, PaperclipIcon } from "../../components/icons";
import { t } from "../../copy";
import { formatDay, formatLongDate, formatTime } from "../../domain/dates";
import { localDateTime } from "../../domain/edit";
import type { NoteFilter, NoteListEntry, TimeFormat } from "../../domain/types";
import { ScreenHeader } from "../shell/ScreenHeader";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";

export function NotesScreen({
  notes,
  total,
  needs,
  filter,
  onFilter,
  selected,
  today,
  timeZone,
  timeFormat,
  accountInitial,
  navigate,
}: {
  notes: NoteListEntry[];
  total: number;
  needs: number;
  filter: NoteFilter;
  onFilter: (filter: NoteFilter) => void;
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
        <p className="mt-1 text-footnote text-ink-secondary">
          {t("notes.summary", { count: total, needs })}
        </p>
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
      {notes.length === 0 && (
        <p className="py-8 text-body text-ink-secondary">
          {t("note.list_empty")}
        </p>
      )}
      {[...days].map(([day, rows]) => (
        <section key={day} className="mb-5">
          <h2 className="mb-3 text-heading font-semibold">
            {formatDay(day, today)}{" "}
            <span className="text-ink-secondary">{rows.length}</span>
          </h2>
          <ul className="m-0 list-none divide-y divide-separator overflow-hidden rounded-box bg-surface p-0">
            {rows.map((note) => {
              const needsLook =
                note.status === "confirm" ||
                note.status === "followup" ||
                note.status === "pending";
              const status = needsLook
                ? t("notes.needs")
                : note.status === "done"
                  ? t("notes.made")
                  : note.status === "kept"
                    ? t("note.kept_label")
                    : null;
              const Icon = note.source_file_name
                ? PaperclipIcon
                : note.status === "done"
                  ? SparklesIcon
                  : NotesIcon;
              return (
                <li key={note.id}>
                  <Link
                    href={ROUTES.note(note.id)}
                    navigate={navigate}
                    aria-current={selected === note.id ? "true" : undefined}
                    className={`focus-ring flex min-h-16 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-fill ${selected === note.id ? "bg-fill" : ""}`}
                  >
                    <Icon size={19} className="text-ink-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {note.name ?? note.excerpt.slice(0, 60)}
                      </span>
                      <span className="block truncate text-footnote text-ink-secondary">
                        {note.source_file_name
                          ? t("note.from_file", {
                              file_name: note.source_file_name,
                            })
                          : note.excerpt}
                      </span>
                    </span>
                    <span
                      className={`max-w-[30%] text-right text-footnote ${needsLook ? "text-warning" : "text-ink-secondary"}`}
                    >
                      {status}
                      {status && note.edited_at ? " · " : ""}
                      {note.edited_at ? (
                        <span className="text-ink-secondary">
                          {t("note.edited_label")}
                        </span>
                      ) : null}
                    </span>
                    <time className="hidden text-footnote text-ink-secondary sm:block">
                      {formatTime(
                        localDateTime(note.written_at, timeZone).time,
                        timeFormat,
                      )}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
