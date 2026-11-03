import { t, tc } from "../../copy";
import type { Progress } from "../../domain/progress";
import type { ProjectColor } from "../../domain/types";
import { Link } from "../shell/Link";
import type { Navigate } from "../shell/routes";
import { ProjectCardMenu } from "./ProjectCardMenu";

export interface ProjectCardProps {
  href?: string;
  name: string;
  colour: ProjectColor;
  progress: Progress;
  navigate?: Navigate;
  label?: string;
  nextText?: string;
  overdueText?: string;
  onRename?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({
  href,
  name,
  colour,
  progress,
  navigate,
  label,
  nextText,
  overdueText,
  onRename,
  onDelete,
}: ProjectCardProps) {
  const percentage = progress.total
    ? (progress.done / progress.total) * 100
    : 0;

  const accessibleName = `${name}, ${t("project.progress", { done: progress.done, total: progress.total })}`;

  const cardContent = (
    <div className="flex h-full flex-col justify-between gap-3 p-4">
      {/* Top: Dot + Name + More button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ background: `var(--color-project-${colour})` }}
            aria-hidden="true"
          />
          <span
            className="truncate text-body font-semibold text-ink"
            data-slot="name"
          >
            {name}
          </span>
        </div>
        <ProjectCardMenu onRename={onRename} onDelete={onDelete} />
      </div>

      {/* Middle: Progress stats & Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-footnote text-ink-secondary">
          <span>
            {t("project.done_completed", {
              done: progress.done,
              total: progress.total,
            })}
          </span>
          <span className="sr-only">
            {t("project.done_of", {
              done: progress.done,
              total: progress.total,
            })}
          </span>
        </div>
        <div
          className="block h-1.5 overflow-hidden rounded-full bg-fill"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              background: `var(--color-project-${colour})`,
            }}
          />
        </div>
      </div>

      {/* Bottom: Next task info or status */}
      <div className="truncate text-footnote text-ink-secondary">
        {overdueText ? (
          <span>
            <span className="font-semibold text-error">
              {overdueText.split("·")[0]}
            </span>
            {overdueText.includes("·") &&
              ` · ${overdueText.split("·").slice(1).join("·")}`}
          </span>
        ) : nextText ? (
          <span>{nextText}</span>
        ) : name === t("project.none") ? (
          <span>{t("project.no_project_tasks")}</span>
        ) : progress.total === 0 ? (
          <span>{t("project.empty")}</span>
        ) : progress.done === progress.total ? (
          <span>{t("project.all_done")}</span>
        ) : (
          <span>
            {tc("project.open_count", progress.total - progress.done)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <li role="listitem" className="list-none">
      {href ? (
        <Link
          href={href}
          navigate={navigate}
          className="focus-ring block h-full rounded-2xl border border-separator bg-surface shadow-xs transition-all hover:border-ink-tertiary hover:shadow-sm"
          aria-label={accessibleName}
        >
          {cardContent}
        </Link>
      ) : (
        <div
          className="focus-ring block h-full rounded-2xl border border-separator bg-surface shadow-xs transition-all"
          role="group"
          aria-label={label ?? accessibleName}
        >
          {cardContent}
        </div>
      )}
    </li>
  );
}
