"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProjectSheet,
  ProjectsScreen,
  ROUTES,
  type Project,
  type ProjectWithCounts,
} from "@/ui";
import { useAppFrame } from "../AppFrame";
import { createProject, listProjects } from "@/lib/projectApi";
import { appClock } from "../appClock";

export function ProjectsClient() {
  const { navigate, user } = useAppFrame();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [creating, setCreating] = useState(false);

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
    </>
  );
}
