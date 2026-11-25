import { useDroppable } from "@dnd-kit/core";
import type { ReactElement } from "react";
import {
  Link,
  PROJECT_DROP,
  ROUTES,
  sortProjects,
  t,
  type Navigate,
  type ProjectWithCounts,
} from "@/ui";
import { cx } from "@/ui/components/cx";

function ProjectRow({
  projectId,
  href,
  name,
  dot,
  count,
  current,
  navigate,
}: {
  /** The project a task dropped here moves to (#178); null: No project. */
  projectId: string | null;
  href: string;
  name: string;
  /** The colour dot's own classes or style. */
  dot: { className?: string; style?: React.CSSProperties };
  count?: number;
  current: boolean;
  navigate: Navigate;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `project-drop:${projectId ?? "none"}`,
    data: { kind: PROJECT_DROP, projectId, name, title: name },
  });
  return (
    <li ref={setNodeRef}>
      <Link
        href={href}
        navigate={navigate}
        className={cx(
          "focus-ring row-hover flex min-h-9 items-center gap-2.5 rounded-field px-3 text-body text-ink-secondary transition-colors",
          current && "bg-primary/15! text-primary! font-medium",
          isOver && "bg-primary/15 ring-1 ring-inset ring-primary/60",
        )}
        aria-current={current ? "page" : undefined}
      >
        <span
          className={cx(
            "inline-block size-2 shrink-0 rounded-full",
            dot.className,
          )}
          style={dot.style}
          aria-hidden="true"
        />
        <span className="flex-1 truncate text-callout">{name}</span>
        {Boolean(count) && (
          <span
            className={cx(
              "text-footnote tabular-nums",
              current ? "text-primary font-semibold" : "text-ink-tertiary",
            )}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}

/** The projects under "Projects" in the sidebar, then No project; the one open is marked. */
export function SidebarProjects({
  projects,
  noProjectCount,
  currentPath,
  navigate,
}: {
  projects: ProjectWithCounts[];
  noProjectCount?: number;
  currentPath: string;
  navigate: Navigate;
}): ReactElement {
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {sortProjects(projects).map((project) => (
        <ProjectRow
          key={project.id}
          projectId={project.id}
          href={ROUTES.project(project.id)}
          name={project.name}
          dot={{
            style: { background: `var(--color-project-${project.colour})` },
          }}
          count={project.open}
          current={currentPath === ROUTES.project(project.id)}
          navigate={navigate}
        />
      ))}
      <ProjectRow
        projectId={null}
        href={ROUTES.noProject}
        name={t("project.none")}
        dot={{ className: "bg-neutral-content/60" }}
        count={noProjectCount}
        current={currentPath === ROUTES.noProject}
        navigate={navigate}
      />
    </ul>
  );
}
