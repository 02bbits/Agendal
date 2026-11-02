"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProjectsScreen,
  ROUTES,
  formatLongDate,
  type Project,
  type ProjectWithCounts,
} from "@/ui";
import { useAppFrame } from "../AppFrame";
import { listProjects } from "@/lib/projectApi";
import { appClock } from "../appClock";
import { useToday } from "@/ui/features/tasks/useToday";
import { ProjectsModals } from "./ProjectsModals";

export function ProjectsClient() {
  const { navigate, user, showToast } = useAppFrame();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] =
    useState<ProjectWithCounts | null>(null);
  const [deletingProject, setDeletingProject] =
    useState<ProjectWithCounts | null>(null);

  const today = useToday(appClock);

  const load = useCallback(() => {
    listProjects()
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
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
      <ProjectsScreen
        projects={projects}
        accountInitial={accountInitial}
        overline={formatLongDate(today)}
        onNewProject={() => setCreating(true)}
        onRenameProject={(p) => setEditingProject(p)}
        onDeleteProject={(p) => setDeletingProject(p)}
        navigate={navigate}
      />
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
