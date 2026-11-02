import { t, tc } from "../../copy";
import { ChevronRightIcon } from "../../components/icons";
import { Link } from "../shell/Link";
import { ROUTES, type Navigate } from "../shell/routes";
import type { ProjectWithCounts } from "./ProjectsScreen";

export interface ProjectMobileListProps {
  projects: ProjectWithCounts[];
  noProjectCounts?: { open: number; done: number };
  navigate?: Navigate;
}

export function ProjectMobileList({
  projects,
  noProjectCounts = { open: 0, done: 0 },
  navigate,
}: ProjectMobileListProps) {
  const noProjectTaskCount = noProjectCounts.open ?? 0;

  return (
    <div className="md:hidden" data-slot="project-mobile-list">
      {/* Grouped project card */}
      <div className="overflow-hidden rounded-2xl border border-separator bg-surface shadow-xs divide-y divide-separator">
        {projects.map((p) => {
          const done = p.done ?? 0;
          const open = p.open ?? 0;
          const total = done + open;
          const percentage = total > 0 ? (done / total) * 100 : 0;
          return (
            <Link
              key={p.id}
              href={ROUTES.project(p.id)}
              navigate={navigate}
              className="focus-ring flex items-center justify-between gap-3 p-4 transition-colors hover:bg-fill-secondary"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ background: `var(--color-project-${p.colour})` }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-body font-semibold text-ink">
                    {p.name}
                  </span>
                </div>
                <div className="pl-5">
                  <div
                    role="progressbar"
                    aria-label={t("project.progress", { done, total })}
                    aria-valuenow={done}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuetext={t("project.progress", { done, total })}
                    className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-fill"
                  >
                    <div
                      data-slot="bar"
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        background: `var(--color-project-${p.colour})`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-footnote text-ink-secondary">
                <span>{t("project.progress_short", { done, total })}</span>
                <ChevronRightIcon size={18} className="text-ink-tertiary" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* No project card */}
      <div
        className="mt-3 flex items-center justify-between rounded-2xl border border-separator bg-surface p-4 shadow-xs"
        role="group"
        aria-label={`${t("project.none")}, ${tc("project.task_count", noProjectTaskCount)}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ background: "var(--color-project-gray)" }}
            aria-hidden="true"
          />
          <span className="truncate text-body font-semibold text-ink">
            {t("project.none")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-footnote text-ink-secondary">
          <span>{tc("project.task_count", noProjectTaskCount)}</span>
          <ChevronRightIcon size={18} className="text-ink-tertiary" />
        </div>
      </div>
    </div>
  );
}
