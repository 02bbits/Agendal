import { Fragment, type ReactNode } from "react";
import { localTime, now, timeZone } from "../../../lib/clock";
import { t } from "../../copy";
import { cx } from "../../components/cx";
import {
  BellIcon,
  CheckIcon,
  FlagIcon,
  RepeatIcon,
} from "../../components/icons";
import { taskAccessibleName } from "../../domain/describe";
import type { EntryKind } from "../../domain/entries";
import { repeatLabel, rowMeta, type MetaTone } from "../../domain/rowMeta";
import type { Project, Task, TimeFormat } from "../../domain/types";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";

export interface TaskRowProps {
  task: Task;
  project?: Project | null;
  today: string;
  timeFormat: TimeFormat;
  entry?: EntryKind;
  tone?: "due";
  /** Overdue rows: red ring and red date, next to the "Overdue" heading word. */
  overdue?: boolean;
  onToggle: (task: Task) => void;
  navigate?: Navigate;
  selected?: boolean;
  /** Just completed and about to move: the tick is locked so it can't be spammed. */
  settling?: boolean;
  /** Search highlights matched words in the title (LV-3). */
  renderTitle?: (title: string) => ReactNode;
}

function metaToneClass(tone: MetaTone): string | undefined {
  if (tone === "due") return "font-semibold text-due-ink";
  if (tone === "late") return "font-medium text-error";
  if (tone === "muted") return "text-ink-tertiary";
  return undefined;
}

/** One task: circular checkbox, title, meta line and priority flag matching Figma design. */
export function TaskRow({
  task,
  project,
  today,
  timeFormat,
  entry,
  tone,
  overdue = false,
  selected = false,
  settling = false,
  onToggle,
  navigate,
  renderTitle,
}: TaskRowProps) {
  const nowTime = localTime(timeZone(), now());
  const accessibleName = taskAccessibleName(task, project, {
    today,
    timeFormat,
    nowTime,
    entry,
  });
  const flag =
    task.priority === "high"
      ? "danger"
      : task.priority === "medium"
        ? "warning"
        : null;

  const metaParts = rowMeta(task, {
    today,
    timeFormat,
    nowTime,
    entry,
  });

  return (
    <li
      className={cx(
        "group/task relative flex min-h-[56px] items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0",
        tone === "due"
          ? "border-dashed border-due/60 hover:bg-due/10"
          : "border-separator/60 hover:bg-surface-hover/40",
        selected && (tone === "due" ? "bg-due/20" : "bg-surface-hover/60"),
        task.done && "is-done",
        overdue && !task.done && "is-overdue",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={t(task.done ? "task.reopen" : "task.complete", {
          title: task.title,
        })}
        aria-disabled={settling || undefined}
        className={cx(
          "group/check inline-flex size-11 -m-1 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-surface focus-visible:outline-2 focus-visible:outline-primary",
          settling ? "cursor-default" : "cursor-pointer",
        )}
        onClick={() => {
          if (!settling) onToggle(task);
        }}
      >
        <span
          className={cx(
            "inline-flex size-[22px] items-center justify-center rounded-full border-[1.5px] transition-colors",
            task.done
              ? "border-ink bg-ink text-surface"
              : overdue
                ? "border-error shadow-[inset_0_0_0_1px_var(--color-error)]"
                : tone === "due"
                  ? "border-due-ink group-hover/check:border-due-ink"
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
        aria-current={selected ? "true" : undefined}
      >
        <span
          className={cx(
            "line-clamp-2 text-body font-medium transition-colors group-[.is-done]/task:text-ink-tertiary group-[.is-done]/task:line-through [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-inherit",
            tone === "due" && !task.done && "text-due-ink",
          )}
          data-slot="title"
        >
          {renderTitle ? renderTitle(task.title) : task.title}
        </span>
        <span
          className="flex flex-wrap items-center gap-1.5 text-footnote text-ink-secondary"
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
          {metaParts.map((part, index) => (
            <Fragment key={index}>
              <span>·</span>
              <span className={metaToneClass(part.tone)}>{part.text}</span>
            </Fragment>
          ))}
          {task.reminder !== "none" && (
            <BellIcon size={13} className="text-ink-tertiary" />
          )}
          {task.repeat !== "never" &&
            (task.done ? (
              <RepeatIcon size={13} className="text-ink-tertiary" />
            ) : (
              <Fragment>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-due-ink">
                  <RepeatIcon size={13} />
                  <span>{repeatLabel(task)}</span>
                </span>
              </Fragment>
            ))}
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
