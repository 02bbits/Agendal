"use client";
import { notifyProjectsChanged } from "@/ui/domain/appEvents";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ProjectsScreen,
  ROUTES,
  RateLimited,
  ScreenHeader,
  formatLongDate,
  t,
  type Project,
  type ProjectWithCounts,
} from "@/ui";
import { rateLimited, type ApiRequestError } from "@/lib/apiError";
import { useAppFrame } from "../AppFrame";
import { readProjects } from "@/lib/localStore";
import { useDataChanged } from "../useDataChanged";
import { listProjects, getProject } from "@/lib/projectApi";
import { appClock } from "../appClock";
import { useToday } from "@/ui/features/tasks/useToday";
import { ProjectsModals } from "./ProjectsModals";
import { ProjectsSkeleton } from "../skeletons";

export function ProjectsClient() {
  const { navigate, user, showToast } = useAppFrame();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [noProjectCounts, setNoProjectCounts] = useState<{
    open: number;
    done: number;
  }>({ open: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  // A 429 on the list: the rate-limited page instead of the screen (UX-43)
  const [limited, setLimited] = useState<ApiRequestError | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] =
    useState<ProjectWithCounts | null>(null);
  const [deletingProject, setDeletingProject] =
    useState<ProjectWithCounts | null>(null);

  const today = useToday(appClock);
  // Set once the network answers; until then the device copy may show (AP-2)
  const fresh = useRef(false);

  const load = useCallback(() => {
    Promise.all([
      listProjects()
        .then((data) => {
          fresh.current = true;
          setLimited(null);
          if (Array.isArray(data)) setProjects(data);
        })
        .catch((error: unknown) => setLimited(rateLimited(error))),
      getProject("none")
        .then((res) => {
          if (res && res.progress) {
            setNoProjectCounts({
              open: res.progress.total - res.progress.done,
              done: res.progress.done,
            });
          }
        })
        .catch(() => {}),
    ]).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void readProjects().then((cached) => {
      if (fresh.current || cached.length === 0) return;
      // The stored rows keep the counts from the last list
      setProjects(cached as ProjectWithCounts[]);
      setLoading(false);
    });
    load();
  }, [load]);

  useDataChanged(load);

  const handleCreated = (created: Project) => {
    setProjects((prev) => [...prev, { ...created, open: 0, done: 0 }]);
    if (typeof window !== "undefined") {
      notifyProjectsChanged();
    }
    setCreating(false);

    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.removeEventListener("popstate", go);
      navigate(ROUTES.project(created.id));
    };
    window.addEventListener("popstate", go);
    setTimeout(go, 250);
  };

  const accountInitial = user?.display_name || user?.email || "";

  return (
    <>
      {limited ? (
        <div className="pb-8">
          <ScreenHeader
            overline={formatLongDate(today)}
            title={t("nav.projects")}
            accountInitial={accountInitial}
            navigate={navigate}
          />
          <RateLimited error={limited} onRetry={load} />
        </div>
      ) : loading ? (
        <div className="pb-8">
          <ScreenHeader
            overline={formatLongDate(today)}
            title={t("nav.projects")}
            accountInitial={accountInitial}
            navigate={navigate}
          />
          <ProjectsSkeleton />
        </div>
      ) : (
        <ProjectsScreen
          projects={projects}
          noProjectCounts={noProjectCounts}
          accountInitial={accountInitial}
          overline={formatLongDate(today)}
          onNewProject={() => setCreating(true)}
          onRenameProject={(p) => setEditingProject(p)}
          onDeleteProject={(p) => setDeletingProject(p)}
          navigate={navigate}
        />
      )}
      <ProjectsModals
        projects={projects}
        setProjects={setProjects}
        creating={creating}
        setCreating={setCreating}
        editingProject={editingProject}
        setEditingProject={setEditingProject}
        deletingProject={deletingProject}
        setDeletingProject={setDeletingProject}
        onCreated={handleCreated}
        showToast={showToast}
      />
    </>
  );
}
