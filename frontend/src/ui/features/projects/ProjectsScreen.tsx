import { useState } from "react";
import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import {
  MoreIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "../../components/icons";
import { sortProjects } from "../../domain/projects";
import type { Progress } from "../../domain/progress";
import type { Project, ProjectColor } from "../../domain/types";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";

export interface ProjectWithCounts extends Project {
  open?: number;
  done?: number;
  next?: string;
  next_task?: {
    id: string;
    title: string;
    due_date?: string | null;
    is_overdue?: boolean;
  } | null;
}

export interface ProjectsScreenProps {
  projects: ProjectWithCounts[];
  noProjectCounts?: { open: number; done: number };
  accountInitial: string;
  onNewProject: () => void;
  onRenameProject?: (project: ProjectWithCounts) => void;
  onDeleteProject?: (project: ProjectWithCounts) => void;
  navigate?: Navigate;
}

function ProjectCard({
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
}: {
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
}) {
  const [menuOpen, setMenuOpen] = useState(false);
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
        {onDelete || onRename ? (
          <div className="relative">
            <button
              type="button"
              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-ink-tertiary transition-colors hover:bg-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={t("project.menu")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreIcon size={16} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-8 z-30 min-w-36 rounded-xl border border-separator bg-surface p-1 shadow-lg"
              >
                {onRename && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-footnote font-medium text-ink hover:bg-fill transition-colors border-0 bg-transparent"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(false);
                      onRename();
                    }}
                  >
                    <PencilIcon size={15} />
                    <span>{t("project.rename")}</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-footnote font-medium text-error hover:bg-error/10 transition-colors border-0 bg-transparent"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    <TrashIcon size={15} />
                    <span>{t("project.delete")}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="size-7" />
        )}
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

/** Projects tab (PJ §2.2): Desktop grid cards, colour, name, progress; No project fixed last; New project. */
export function ProjectsScreen({
  projects,
  noProjectCounts = { open: 0, done: 0 },
  accountInitial,
  onNewProject,
  onRenameProject,
  onDeleteProject,
  navigate,
}: ProjectsScreenProps) {
  const sortedProjects: ProjectWithCounts[] = sortProjects(projects);
  const totalOpen =
    sortedProjects.reduce((sum, p) => sum + (p.open ?? 0), 0) +
    (noProjectCounts.open ?? 0);

  const noProjectProgress: Progress = {
    done: noProjectCounts.done,
    total: noProjectCounts.open + noProjectCounts.done,
  };

  return (
    <div className="pb-8">
      {/* Header section matching Desktop · Projects */}
      <div className="mb-6 pt-3 md:pt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 font-serif text-title sm:text-display font-bold text-ink focus:outline-none">
              {t("nav.projects")}
            </h1>
            <p className="m-0 mt-1 text-footnote text-ink-secondary">
              {tc("project.count", sortedProjects.length)}
              {" · "}
              {tc("project.open_count", totalOpen)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {accountInitial && (
              <span className="flex size-8 items-center justify-center rounded-full bg-fill text-footnote font-semibold text-ink md:hidden">
                {accountInitial.slice(0, 1).toUpperCase()}
              </span>
            )}
            <Button
              variant="primary"
              pill
              className="px-5 py-2.5 text-callout font-medium"
              onClick={onNewProject}
            >
              <PlusIcon size={16} />
              {t("project.new")}
            </Button>
          </div>
        </div>
      </div>

      {sortedProjects.length === 0 ? (
        <EmptyState title={t("project.list_empty")} />
      ) : (
        <ul className="m-0 grid grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedProjects.map((p) => {
            const done = p.done ?? 0;
            const open = p.open ?? 0;
            const progress: Progress = { done, total: done + open };
            return (
              <ProjectCard
                key={p.id}
                href={ROUTES.project(p.id)}
                name={p.name}
                colour={p.colour}
                progress={progress}
                nextText={p.next}
                onRename={
                  onRenameProject ? () => onRenameProject(p) : undefined
                }
                onDelete={
                  onDeleteProject ? () => onDeleteProject(p) : undefined
                }
                navigate={navigate}
              />
            );
          })}
          <ProjectCard
            name={t("project.none")}
            colour="gray"
            progress={noProjectProgress}
            label={`${t("project.none")}, ${t("project.progress", { done: noProjectProgress.done, total: noProjectProgress.total })}`}
          />
        </ul>
      )}
    </div>
  );
}
