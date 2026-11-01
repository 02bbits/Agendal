"use client";

import { useEffect, useState } from "react";
import { ProjectScreen, ROUTES, t } from "@/ui";
import { useAppFrame } from "../../AppFrame";
import {
  deleteProject,
  getProject,
  restoreProject,
  type ProjectDetailResponse,
} from "@/lib/projectApi";
import { useToday } from "@/ui/features/tasks/useToday";
import { appClock } from "../../appClock";
import { PageMessage } from "../../PageMessage";
import type { ProjectTaskAction } from "@/ui/features/projects/DeleteProjectDialog";

export function ProjectClient({ id }: { id: string }) {
  const { navigate, back, showToast, settings } = useAppFrame();
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [error, setError] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const today = useToday(appClock);

  useEffect(() => {
    let active = true;
    getProject(id)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoading(false);
        setError(err?.status ?? 500);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleDelete = async (action: ProjectTaskAction) => {
    if (!data) return;
    try {
      const res = await deleteProject(data.project.id, action);
      navigate(ROUTES.projects);
      showToast({
        message: t("project.deleted", { name: data.project.name }),
        actionLabel: t("common.undo"),
        onAction: async () => {
          try {
            await restoreProject(data.project.id, res.undo);
            showToast(
              t("project.progress", {
                done: data.progress.done,
                total: data.progress.total,
              }),
            );
          } catch {
            showToast(t("error.save_failed"));
          }
        },
      });
    } catch {
      showToast(t("error.save_failed"));
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-ink-secondary">
        {t("common.back")}...
      </div>
    );
  }

  if (error === 404 || !data) {
    return (
      <PageMessage
        message={t("error.not_found")}
        actionLabel={t("common.back")}
        onAction={back}
      />
    );
  }

  return (
    <ProjectScreen
      project={data.project}
      progress={data.progress}
      openTasks={data.open}
      completedTasks={data.completed}
      today={today}
      timeFormat={settings.timeFormat}
      onBack={back}
      onDeleteProject={handleDelete}
      navigate={navigate}
    />
  );
}
