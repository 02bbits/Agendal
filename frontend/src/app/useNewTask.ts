"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { t, type NewTaskSheetProps, type Project } from "@/ui";
import { createTask, projects as fetchProjects } from "@/lib/taskApi";

export interface UseNewTaskOptions {
  pathname?: string;
  showToast: (message: string) => void;
}

export interface UseNewTaskReturn {
  open: boolean;
  openNewTask: () => void;
  sheetProps: NewTaskSheetProps;
}

export function useNewTask({
  pathname: explicitPathname,
  showToast,
}: UseNewTaskOptions): UseNewTaskReturn {
  const currentPathname = usePathname();
  const pathname = explicitPathname ?? currentPathname ?? "/";

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<"ready" | "failed">(
    "ready",
  );

  const loadProjects = useCallback(() => {
    fetchProjects()
      .then((p) => {
        setProjects(p);
        setProjectsStatus("ready");
      })
      .catch(() => {
        setProjectsStatus("failed");
      });
  }, []);

  const openNewTask = useCallback(() => {
    setOpen(true);
    loadProjects();
  }, [loadProjects]);

  const closeNewTask = useCallback(() => setOpen(false), []);

  const handleAdded = useCallback(
    (title: string) => {
      showToast(t("task.added", { title }));
    },
    [showToast],
  );

  const sheetProps: NewTaskSheetProps = {
    open,
    pathname,
    projects,
    projectsStatus,
    onRetryProjects: loadProjects,
    onCreate: createTask,
    onAdded: handleAdded,
    onClose: closeNewTask,
  };

  return {
    open,
    openNewTask,
    sheetProps,
  };
}
