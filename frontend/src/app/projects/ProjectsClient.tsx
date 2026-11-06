"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProjectsScreen,
  ROUTES,
  ScreenHeader,
  formatLongDate,
  t,
  type Project,
  type ProjectWithCounts,
} from "@/ui";
import { useAppFrame } from "../AppFrame";
import { listProjects, getProject } from "@/lib/projectApi";
import { appClock } from "../appClock";
import { useToday } from "@/ui/features/tasks/useToday";
import { ProjectsModals } from "./ProjectsModals";

export function ProjectsClient() {
  const { navigate, user, showToast } = useAppFrame();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [noProjectCounts, setNoProjectCounts] = useState<{
    open: number;
    done: number;
  }>({ open: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] =
    useState<ProjectWithCounts | null>(null);
  const [deletingProject, setDeletingProject] =
    useState<ProjectWithCounts | null>(null);

  const today = useToday(appClock);

  const load = useCallback(() => {
    Promise.all([
      listProjects()
        .then((data) => {
          if (Array.isArray(data)) setProjects(data);
        })
        .catch(() => {}),
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
    load();
  }, [load]);

  useEffect(() => {
    const handleProjectsChanged = () => {
      load();
    };
    window.addEventListener("agendal:projects-changed", handleProjectsChanged);
    return () => {
      window.removeEventListener(
        "agendal:projects-changed",
        handleProjectsChanged,
      );
    };
  }, [load]);

  const handleCreated = (created: Project) => {
    setProjects((prev) => [...prev, { ...created, open: 0, done: 0 }]);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
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
      {loading ? (
        <div className="pb-8">
          <ScreenHeader
            overline={formatLongDate(today)}
            title={t("nav.projects")}
            accountInitial={accountInitial}
            navigate={navigate}
          />
          <div
            data-testid="projects-loading"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse"
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-2xl border border-separator/50 bg-surface p-5 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-3 shrink-0 rounded-full bg-fill/80" />
                  <div
                    className="h-5 rounded-xl bg-fill/80"
                    style={{ width: i % 2 === 0 ? "60%" : "45%" }}
                  />
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-fill/60" />
                <div className="h-3.5 w-24 rounded-lg bg-fill/50" />
              </div>
            ))}
          </div>
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
