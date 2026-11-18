"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { t, type NewTaskSheetProps, type Project } from "@/ui";
import { createTask, projects as fetchProjects } from "@/lib/taskApi";

type CreateTaskBody = Parameters<typeof createTask>[0];

export interface UseNewTaskOptions {
  pathname?: string;
  showToast: (message: string) => void;
}

export interface OpenNewTaskOptions {
  dueDate?: string;
}

export type OpenNewTaskFn = {
  (opts?: OpenNewTaskOptions): void;
  (event: unknown): void;
};

export interface UseNewTaskReturn {
  open: boolean;
  openNewTask: OpenNewTaskFn;
  sheetProps: NewTaskSheetProps;
}

export function useNewTask({
  pathname: explicitPathname,
  showToast,
}: UseNewTaskOptions): UseNewTaskReturn {
  const currentPathname = usePathname();
  const pathname = explicitPathname ?? currentPathname ?? "/";

  const [open, setOpen] = useState(false);
  const [initialStartDate, setInitialStartDate] = useState<
    string | undefined
  >();
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

  const openNewTask = useCallback(
    (opts?: unknown) => {
      // The date a task is created on is its start date (#154)
      const startDate =
        opts &&
        typeof opts === "object" &&
        "startDate" in opts &&
        typeof (opts as { startDate: unknown }).startDate === "string"
          ? (opts as { startDate: string }).startDate
          : undefined;
      setInitialStartDate(startDate);
      setOpen(true);
      loadProjects();
    },
    [loadProjects],
  );

  const closeNewTask = useCallback(() => {
    setOpen(false);
    setInitialStartDate(undefined);
  }, []);

  const handleAdded = useCallback(
    (title: string) => {
      showToast(t("task.added", { title }));
    },
    [showToast],
  );

  const handleCreate = useCallback(async (body: CreateTaskBody) => {
    const created = await createTask(body);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("agendal:task-created", { detail: created }),
      );
      window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
    }
    return created;
  }, []);

  const sheetProps: NewTaskSheetProps = {
    open,
    pathname,
    initialStartDate,
    projects,
    projectsStatus,
    onRetryProjects: loadProjects,
    onCreate: handleCreate,
    onAdded: handleAdded,
    onClose: closeNewTask,
  };

  return {
    open,
    openNewTask,
    sheetProps,
  };
}
