import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, ProjectWithCounts, TabId } from "@/ui";
import { listNotes, NOTE_UPDATED } from "@/lib/noteApi";
import { getProject, listProjects } from "@/lib/projectApi";
import { inbox, upcoming } from "@/lib/taskApi";
import { isMainPath, PUBLIC_PATHS } from "./frameRoutes";

const TASK_CREATED = "agendal:task-created";
export const PROJECTS_CHANGED = "agendal:projects-changed";

type Counts = Partial<Record<TabId, number>>;
/** The tabs' counts, and the open tasks under No project. */
type SidebarCounts = Counts & { noProject?: number };

/** Asks for one count; a failed request leaves the last one. */
function loadInto<T>(
  request: () => Promise<T>,
  read: (data: T) => number | undefined,
  key: keyof SidebarCounts,
  set: (update: (prev: SidebarCounts) => SidebarCounts) => void,
) {
  request()
    .then((data) => {
      const value = data ? read(data) : undefined;
      if (value !== undefined) set((prev) => ({ ...prev, [key]: value }));
    })
    .catch(() => {});
}

/**
 * What the sidebar shows: the projects and the open count of each tab, fetched on the tab screens
 * and a project's page, and again after a task or project changes or the app comes back.
 */
export function useSidebarData(pathname: string) {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [counts, setCounts] = useState<SidebarCounts>({});
  const active = isMainPath(pathname) && !PUBLIC_PATHS.includes(pathname);

  const load = useCallback(() => {
    if (!active) return;
    listProjects()
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
    loadInto(
      () => getProject("none"),
      (data) => data.progress && data.progress.total - data.progress.done,
      "noProject",
      setCounts,
    );
    loadInto(
      inbox,
      (data) => (data.overdue?.length ?? 0) + (data.today?.length ?? 0),
      "inbox",
      setCounts,
    );
    loadInto(listNotes, (data) => data.total, "notes", setCounts);
    loadInto(
      upcoming,
      (data) =>
        data.total_count ??
        data.days.reduce((sum, day) => sum + (day.tasks?.length ?? 0), 0),
      "upcoming",
      setCounts,
    );
  }, [active]);

  // Again on every screen change, so a count changed on the last screen is right
  useEffect(load, [load, pathname]);

  useEffect(() => {
    // Only on coming back: leaving the tab (Alt+Tab) used to reload every count as well
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener(TASK_CREATED, load);
    window.addEventListener(PROJECTS_CHANGED, load);
    window.addEventListener(NOTE_UPDATED, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(TASK_CREATED, load);
      window.removeEventListener(PROJECTS_CHANGED, load);
      window.removeEventListener(NOTE_UPDATED, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const tabCounts = useMemo<Counts>(() => {
    const { inbox, upcoming, notes } = counts;
    // No project counts as one more row under Projects
    const projectRows = projects.length > 0 ? projects.length + 1 : undefined;
    return { inbox, upcoming, notes, projects: projectRows };
  }, [counts, projects.length]);

  /** A project made in the sheet shows at once, before the next fetch. */
  const addProject = useCallback((created: Project) => {
    setProjects((prev) => [...prev, { ...created, open: 0, done: 0 }]);
    window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED));
  }, []);

  return {
    projects,
    noProjectCount: counts.noProject,
    tabCounts,
    addProject,
  };
}
