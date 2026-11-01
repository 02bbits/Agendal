"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DeleteProjectDialog,
  ProjectSheet,
  ProjectsScreen,
  ROUTES,
  t,
  type Project,
  type ProjectWithCounts,
} from "@/ui";
import { useAppFrame } from "../AppFrame";
import {
  createProject,
  deleteProject,
  listProjects,
  restoreProject,
  updateProject,
} from "@/lib/projectApi";
import { appClock } from "../appClock";

export function ProjectsClient() {
  const { navigate, user, showToast } = useAppFrame();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] =
    useState<ProjectWithCounts | null>(null);
  const [deletingProject, setDeletingProject] =
    useState<ProjectWithCounts | null>(null);

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
        onNewProject={() => setCreating(true)}
        onRenameProject={(p) => setEditingProject(p)}
        onDeleteProject={(p) => setDeletingProject(p)}
        navigate={navigate}
      />
      {creating && (
        <ProjectSheet
          open
          projects={projects}
          onClose={() => setCreating(false)}
          clock={appClock}
          onCreate={createProject}
          onCreated={handleCreated}
        />
      )}
      {editingProject && (
        <ProjectSheet
          open
          projects={projects}
          project={editingProject}
          onClose={() => setEditingProject(null)}
          clock={appClock}
          onUpdate={updateProject}
          onUpdated={(updated) => {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === updated.id
                  ? { ...p, name: updated.name, colour: updated.colour }
                  : p,
              ),
            );
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
            }
            setEditingProject(null);
          }}
        />
      )}
      {deletingProject && (
        <DeleteProjectDialog
          open
          project={deletingProject}
          taskCount={(deletingProject.open ?? 0) + (deletingProject.done ?? 0)}
          onCancel={() => setDeletingProject(null)}
          onConfirm={async (action) => {
            const target = deletingProject;
            setDeletingProject(null);
            try {
              const res = await deleteProject(target.id, action);
              setProjects((prev) => prev.filter((p) => p.id !== target.id));
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("agendal:projects-changed"),
                );
              }
              showToast({
                message: t("project.deleted", { name: target.name }),
                actionLabel: t("common.undo"),
                onAction: async () => {
                  try {
                    await restoreProject(target.id, res.undo);
                    setProjects((prev) => [...prev, target]);
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("agendal:projects-changed"),
                      );
                    }
                  } catch {
                    showToast(t("error.save_failed"));
                  }
                },
              });
            } catch {
              showToast(t("error.save_failed"));
            }
          }}
        />
      )}
    </>
  );
}
