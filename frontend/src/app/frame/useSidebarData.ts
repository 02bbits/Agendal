import { notifyProjectsChanged } from "@/ui/domain/appEvents";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, ProjectWithCounts, TabId } from "@/ui";
import { sidebarCounts, type SidebarCounts } from "@/lib/countsApi";
import { listProjects } from "@/lib/projectApi";
import { useDataChanged } from "../useDataChanged";
import { isMainPath, PUBLIC_PATHS } from "./frameRoutes";

type Counts = Partial<Record<TabId, number>>;

/**
 * What the sidebar shows: the projects and the open count of each tab. Fetched when the sidebar
 * first shows and after data changed, not on every screen change (AP §10 request budget).
 */
export function useSidebarData(pathname: string) {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [counts, setCounts] = useState<Partial<SidebarCounts>>({});
  const active = isMainPath(pathname) && !PUBLIC_PATHS.includes(pathname);

  const load = useCallback(() => {
    if (!active) return;
    // A failed request keeps what is shown
    listProjects()
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
    sidebarCounts()
      .then(setCounts)
      .catch(() => {});
  }, [active]);

  useEffect(load, [load]);
  useDataChanged(load);

  const tabCounts = useMemo<Counts>(() => {
    const { inbox, upcoming, notes } = counts;
    // No project counts as one more row under Projects
    const projectRows = projects.length > 0 ? projects.length + 1 : undefined;
    return { inbox, upcoming, notes, projects: projectRows };
  }, [counts, projects.length]);

  /** A project made in the sheet shows at once, before the next fetch. */
  const addProject = useCallback((created: Project) => {
    setProjects((prev) => [...prev, { ...created, open: 0, done: 0 }]);
    notifyProjectsChanged();
  }, []);

  return {
    projects,
    noProjectCount: counts.no_project,
    tabCounts,
    addProject,
  };
}
