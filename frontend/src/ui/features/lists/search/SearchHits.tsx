import { timeZone } from "../../../../lib/clock";
import { cx } from "../../../components/cx";
import {
  BellIcon,
  CheckIcon,
  FlagIcon,
  NotesIcon,
} from "../../../components/icons";
import { ProjectDot } from "../../../components/ProjectDot";
import { t } from "../../../copy";
import { formatDay, formatTime } from "../../../domain/dates";
import { localDateTime } from "../../../domain/edit";
import type { NoteHit } from "../../../domain/search";
import type { Project, Task, TimeFormat } from "../../../domain/types";
import { Highlighted } from "./Highlighted";

/** A task found: its done circle, title, project, due date and reminder, and a high-priority flag. */
export function TaskHit({
  task,
  project,
  query,
  today,
  timeFormat,
}: {
  task: Task;
  project?: Project;
  query: string;
  today: string;
  timeFormat: TimeFormat;
}) {
  return (
    <>
      <span
        className={cx(
          "inline-flex size-[22px] items-center justify-center rounded-full border-[1.5px] transition-colors shrink-0",
          task.done ? "border-ink bg-ink text-surface" : "border-ink-tertiary",
        )}
        aria-hidden="true"
      >
        {task.done && <CheckIcon size={14} strokeWidth={2.5} />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-body font-medium text-ink">
          <Highlighted text={task.title} query={query} />
        </span>
        <span
          className="flex flex-wrap items-center gap-1.5 text-footnote text-ink-secondary"
          aria-hidden="true"
        >
          <span
            className="mr-0.5 inline-block size-2 shrink-0 rounded-full"
            style={{
              background: `var(--color-project-${project ? project.colour : "gray"})`,
            }}
          />
          <span>{project ? project.name : t("project.none")}</span>
          {task.due_date && (
            <>
              <span>·</span>
              <span>
                {formatDay(task.due_date, today)}
                {task.due_time
                  ? ` ${formatTime(task.due_time, timeFormat)}`
                  : ""}
              </span>
            </>
          )}
          {task.reminder !== "none" && (
            <BellIcon size={13} className="text-ink-tertiary" />
          )}
        </span>
      </div>

      {task.priority === "high" && !task.done && (
        <span
          className="ml-2 shrink-0 self-center text-error"
          data-slot="flag"
          aria-hidden="true"
        >
          <FlagIcon size={18} />
        </span>
      )}
    </>
  );
}

/** A note found: its title and the matching snippet, and when it was written. */
export function NoteHitRow({
  note,
  query,
  today,
}: {
  note: NoteHit;
  query: string;
  today: string;
}) {
  const written = localDateTime(note.written_at, timeZone());
  return (
    <>
      <NotesIcon size={18} className="mt-0.5 shrink-0 text-ink-secondary" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-1 text-body font-medium text-ink">
          <Highlighted text={note.title} query={query} />
        </span>
        <span className="line-clamp-2 text-footnote text-ink-secondary">
          <Highlighted text={note.snippet} query={query} />
        </span>
        <span className="text-[12px] text-ink-tertiary">
          {`${formatDay(written.date, today)} ${written.time}`}
        </span>
      </div>
    </>
  );
}

/** A project found: its colour dot and name. */
export function ProjectHit({
  project,
  query,
}: {
  project: Project;
  query: string;
}) {
  return (
    <>
      <ProjectDot colour={project.colour} />
      <span className="flex-1 truncate text-body font-medium text-ink">
        <Highlighted text={project.name} query={query} />
      </span>
    </>
  );
}
