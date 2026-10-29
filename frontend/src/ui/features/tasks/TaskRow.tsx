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

/** One task: checkbox, title (2 lines), meta line and priority flag. Tapping the row opens details. */
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
        "group/task relative flex min-h-[52px] items-start after:absolute after:right-0 after:bottom-0 after:left-[34px] after:border-b after:border-separator",
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
        className="group/check mt-1 -ml-[11px] inline-flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-paper focus-visible:outline-none"
        onClick={() => onToggle(task)}
      >
        <span
          className="inline-flex size-[22px] items-center justify-center rounded-full shadow-[inset_0_0_0_2px_var(--color-ink-tertiary)] group-[.is-overdue]/task:shadow-[inset_0_0_0_2px_var(--color-error)] group-aria-checked/check:bg-ink group-aria-checked/check:shadow-none group-focus-visible/check:outline-2 group-focus-visible/check:outline-offset-2 group-focus-visible/check:outline-primary"
          aria-hidden="true"
        >
          {task.done && <CheckIcon size={14} strokeWidth={2.5} />}
        </span>
      </button>
      <Link
        href={ROUTES.task(task.id)}
        navigate={navigate}
        className="focus-ring flex min-w-0 flex-1 flex-col gap-0.5 rounded-tile py-3 pr-2 pl-px text-ink"
        aria-label={accessibleName}
      >
        <span
          className="line-clamp-2 text-body font-medium group-[.is-done]/task:font-normal group-[.is-done]/task:text-ink-tertiary group-[.is-done]/task:line-through [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-inherit"
          data-slot="title"
        >
          {renderTitle ? renderTitle(task.title) : task.title}
        </span>
        <span
          className="flex flex-wrap items-center gap-1 text-footnote text-ink-secondary"
          data-slot="meta"
          aria-hidden="true"
        >
          <span
            className="mr-0.5 inline-block size-2 shrink-0 rounded-full"
            data-slot="dot"
            style={{
              background: `var(--color-project-${project ? project.colour : "gray"})`,
            }}
          />
          <span>{project ? project.name : t("project.none")}</span>
          {showDue && task.due_date && (
            <>
              <span>·</span>
              <span className={cx(overdue && "text-error")}>
                {formatDay(task.due_date, today)}
              </span>
            </>
          )}
          {task.start_time && (
            <>
              <span>·</span>
              <span className={cx(overdue && "text-error")}>
                {formatTimeRange(task.start_time, task.end_time, timeFormat)}
              </span>
            </>
          )}
          {task.reminder !== "none" && <BellIcon size={12} />}
          {task.repeat !== "never" && <RepeatIcon size={12} />}
        </span>
      </Link>
      {flag && !task.done && (
        <span
          className={cx(
            "shrink-0 pt-3",
            flag === "danger" ? "text-error" : "text-warning",
          )}
          data-slot="flag"
          data-tone={flag}
          aria-hidden="true"
        >
          <FlagIcon size={16} />
        </span>
      )}
    </li>
  );
}
