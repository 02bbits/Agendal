import type { ReactNode } from "react";
import { t } from "../../copy";
import { cx } from "../../components/cx";
import {
  BellIcon,
  CheckIcon,
  FlagIcon,
  RepeatIcon,
} from "../../components/icons";
import { formatDay, formatTimeRange } from "../../domain/dates";
import { taskAccessibleName } from "../../domain/describe";
import type { Project, Task, TimeFormat } from "../../domain/types";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";

export interface TaskRowProps {
  task: Task;
  project?: Project | null;
  today: string;
  timeFormat: TimeFormat;
  /** Overdue, Search and No date rows start the meta line with the due date (LV-4). */
  showDue?: boolean;
  /** Overdue rows: red ring and red date, next to the "Overdue" heading word. */
  overdue?: boolean;
  onToggle: (task: Task) => void;
  navigate?: Navigate;
  /** Search highlights matched words in the title (LV-3). */
  renderTitle?: (title: string) => ReactNode;
}

/** One task: circular checkbox, title, meta line and priority flag matching Figma design. */
export function TaskRow({
  task,
  project,
  today,
  timeFormat,
  showDue = false,
  overdue = false,
  onToggle,
  navigate,
  renderTitle,
}: TaskRowProps) {
  const accessibleName = taskAccessibleName(task, project, {
    today,
    timeFormat,
    showDue,
  });
  const flag =
    task.priority === "high"
      ? "danger"
      : task.priority === "medium"
        ? "warning"
        : null;

  return (
    <li
      className={cx(
        "group/task relative flex min-h-[56px] items-center gap-3 border-b border-separator/60 px-4 py-3 transition-colors hover:bg-surface-hover/40 last:border-b-0",
        task.done && "is-done",
        overdue && "is-overdue",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={t(task.done ? "task.reopen" : "task.complete", {
          title: task.title,
        })}
        className="group/check inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-surface focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => onToggle(task)}
      >
        <span
          className={cx(
            "inline-flex size-[22px] items-center justify-center rounded-full border-[1.5px] transition-colors",
            overdue
              ? "border-error shadow-[inset_0_0_0_1px_var(--color-error)]"
              : task.done
                ? "border-ink bg-ink text-surface"
                : "border-ink-tertiary group-hover/check:border-ink-secondary",
          )}
          aria-hidden="true"
        >
          {task.done && <CheckIcon size={14} strokeWidth={2.5} />}
        </span>
      </button>

      <Link
        href={ROUTES.task(task.id)}
        navigate={navigate}
        className="focus-ring flex min-w-0 flex-1 flex-col gap-0.5 rounded-tile py-0.5 text-ink"
        aria-label={accessibleName}
      >
        <span
          className="line-clamp-2 text-body font-medium group-[.is-done]/task:text-ink-tertiary group-[.is-done]/task:line-through [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-inherit"
          data-slot="title"
        >
          {renderTitle ? renderTitle(task.title) : task.title}
        </span>
        <span
          className="flex flex-wrap items-center gap-1.5 text-footnote text-ink-secondary"
          data-slot="meta"
          aria-hidden="true"
        >
          {showDue && task.due_date && (
            <>
              <span className={cx(overdue && "text-error font-medium")}>
                {formatDay(task.due_date, today)}
              </span>
              <span>·</span>
            </>
          )}
          <span
            className="mr-0.5 inline-block size-2 shrink-0 rounded-full"
            data-slot="dot"
            style={{
              background: `var(--color-project-${project ? project.colour : "gray"})`,
            }}
          />
          <span>{project ? project.name : t("project.none")}</span>
          {task.start_time && (
            <>
              <span>·</span>
              <span>
                {formatTimeRange(task.start_time, task.end_time, timeFormat)}
              </span>
            </>
          )}
          {task.reminder !== "none" && (
            <BellIcon size={13} className="text-ink-tertiary" />
          )}
          {task.repeat !== "never" && (
            <RepeatIcon size={13} className="text-ink-tertiary" />
          )}
        </span>
      </Link>

      {flag && !task.done && (
        <span
          className={cx(
            "ml-2 shrink-0 self-center",
            flag === "danger" ? "text-error" : "text-warning",
          )}
          data-slot="flag"
          data-tone={flag}
          aria-hidden="true"
        >
          <FlagIcon size={18} />
        </span>
      )}
    </li>
  );
}
