"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProjectSheet,
  ProjectsScreen,
  ROUTES,
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
          onCreated={(created) => {
            navigate(ROUTES.project(created.id));
          }}
        />
      )}
    </>
  );
}
