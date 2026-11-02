import { t, tc } from "../../copy";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PlusIcon } from "../../components/icons";
import { today } from "../../../lib/clock";
import { formatLongDate } from "../../domain/dates";
import { sortProjects } from "../../domain/projects";
import type { Progress } from "../../domain/progress";
import type { Project } from "../../domain/types";
import { ROUTES, type Navigate } from "../shell/routes";
import { ScreenHeader } from "../shell/ScreenHeader";
import { ProjectCard } from "./ProjectCard";
import { ProjectMobileList } from "./ProjectMobileList";

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
  overline?: string;
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
  overline,
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
      <ScreenHeader
        overline={overline ?? formatLongDate(today())}
        title={t("nav.projects")}
        accountInitial={accountInitial}
        action={
          <Button
            variant="primary"
            pill
            className="px-5 py-2.5 text-callout font-medium"
            onClick={onNewProject}
          >
            <PlusIcon size={16} />
            {t("project.new")}
          </Button>
        }
        navigate={navigate}
      >
        <p className="m-0 mt-1 text-footnote text-ink-secondary">
          {tc("project.count", sortedProjects.length)}
          {" · "}
          {tc("project.open_count", totalOpen)}
        </p>
      </ScreenHeader>

      {sortedProjects.length === 0 ? (
        <EmptyState title={t("project.list_empty")} />
      ) : (
        <>
          <ProjectMobileList
            projects={sortedProjects}
            noProjectCounts={noProjectCounts}
            navigate={navigate}
          />
          <ul className="m-0 hidden grid-cols-1 gap-4 p-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              href={ROUTES.noProject}
              navigate={navigate}
              name={t("project.none")}
              colour="gray"
              progress={noProjectProgress}
              label={`${t("project.none")}, ${t("project.progress", { done: noProjectProgress.done, total: noProjectProgress.total })}`}
            />
          </ul>
        </>
      )}
    </div>
  );
}
