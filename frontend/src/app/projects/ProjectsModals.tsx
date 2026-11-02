import {
  DeleteProjectDialog,
  ProjectSheet,
  t,
  type Project,
  type ProjectWithCounts,
  type ToastData,
} from "@/ui";
import {
  createProject,
  deleteProject,
  restoreProject,
  updateProject,
} from "@/lib/projectApi";
import { appClock } from "../appClock";

export interface ProjectsModalsProps {
  projects: ProjectWithCounts[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectWithCounts[]>>;
  creating: boolean;
  setCreating: (v: boolean) => void;
  editingProject: ProjectWithCounts | null;
  setEditingProject: (p: ProjectWithCounts | null) => void;
  deletingProject: ProjectWithCounts | null;
  setDeletingProject: (p: ProjectWithCounts | null) => void;
  onCreated: (created: Project) => void;
  showToast: (messageOrDraft: string | Omit<ToastData, "id">) => void;
}

export function ProjectsModals({
  projects,
  setProjects,
  creating,
  setCreating,
  editingProject,
  setEditingProject,
  deletingProject,
  setDeletingProject,
  onCreated,
  showToast,
}: ProjectsModalsProps) {
  return (
    <>
      {creating && (
        <ProjectSheet
          open
          projects={projects}
          onClose={() => setCreating(false)}
          clock={appClock}
          onCreate={createProject}
          onCreated={onCreated}
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
