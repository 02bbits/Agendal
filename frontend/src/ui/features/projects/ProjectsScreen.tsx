import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ChevronRightIcon, PlusIcon } from "../../components/icons";
import { sortProjects } from "../../domain/projects";
import type { Progress } from "../../domain/progress";
import type { Project, ProjectColor } from "../../domain/types";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";
import { ScreenHeader } from "../shell/ScreenHeader";

export interface ProjectWithCounts extends Project {
  open?: number;
  done?: number;
}

export interface ProjectsScreenProps {
  projects: ProjectWithCounts[];
  noProjectCounts?: { open: number; done: number };
  accountInitial: string;
  onNewProject: () => void;
  navigate?: Navigate;
}

function ProjectRow({
  href,
  name,
  colour,
  progress,
  navigate,
  label,
}: {
  href?: string;
  name: string;
  colour: ProjectColor;
  progress: Progress;
  navigate?: Navigate;
  label?: string;
}) {
  const body = (
    <>
      <span
        className="mr-0.5 inline-block size-2 shrink-0 rounded-full"
        style={{ background: `var(--color-project-${colour})` }}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-body font-medium" data-slot="name">
          {name}
        </span>
        <span
          className="block h-[3px] overflow-hidden rounded-full bg-fill"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-[inherit]"
            style={{
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              background: `var(--color-project-${colour})`,
            }}
          />
        </span>
      </span>
      <span className="text-footnote text-ink-secondary">
        {t("project.done_of", { done: progress.done, total: progress.total })}
      </span>
      {href && (
        <ChevronRightIcon size={18} className="shrink-0 text-ink-tertiary" />
      )}
    </>
  );
  const accessibleName = `${name}, ${t("project.progress", { done: progress.done, total: progress.total })}`;
  return (
    <li>
      {href ? (
        <Link
          href={href}
          navigate={navigate}
          className="focus-ring flex min-h-14 items-center gap-3 rounded-tile border-b border-separator py-2 text-ink"
          aria-label={accessibleName}
        >
          {body}
        </Link>
      ) : (
        <div
          className="focus-ring flex min-h-14 items-center gap-3 rounded-tile border-b border-separator py-2 text-ink"
          role="group"
          aria-label={label ?? accessibleName}
        >
          {body}
        </div>
      )}
    </li>
  );
}

/** Projects tab (PJ §2.2): colour, name, progress; No project fixed last; New project. */
export function ProjectsScreen({
  projects,
  noProjectCounts = { open: 0, done: 0 },
  accountInitial,
  onNewProject,
  navigate,
}: ProjectsScreenProps) {
  const sortedProjects: ProjectWithCounts[] = sortProjects(projects);
  const noProjectProgress: Progress = {
    done: noProjectCounts.done,
    total: noProjectCounts.open + noProjectCounts.done,
  };

  return (
    <div className="pb-8">
      <ScreenHeader
        overline={tc("project.count", sortedProjects.length)}
        title={t("nav.projects")}
        accountInitial={accountInitial}
        navigate={navigate}
      />
      {sortedProjects.length === 0 ? (
        <EmptyState title={t("project.list_empty")} />
      ) : (
        <ul className="m-0 list-none p-0">
          {sortedProjects.map((p) => {
            const done = p.done ?? 0;
            const open = p.open ?? 0;
            const progress: Progress = { done, total: done + open };
            return (
              <ProjectRow
                key={p.id}
                href={ROUTES.project(p.id)}
                name={p.name}
                colour={p.colour}
                progress={progress}
                navigate={navigate}
              />
            );
          })}
          <ProjectRow
            name={t("project.none")}
            colour="gray"
            progress={noProjectProgress}
            label={`${t("project.none")}, ${t("project.progress", { done: noProjectProgress.done, total: noProjectProgress.total })}`}
          />
        </ul>
      )}
      <div className="mt-5">
        <Button variant="outline" fullWidth onClick={onNewProject}>
          <PlusIcon size={18} />
          {t("project.new")}
        </Button>
      </div>
    </div>
  );
}
