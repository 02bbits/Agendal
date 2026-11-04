import { useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../components/Button";
import { FolderIcon, PlusIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { ProjectDot } from "../../../components/ProjectDot";
import { t } from "../../../copy";
import type { Project } from "../../../domain/types";
import { createProject } from "../../../../lib/projectApi";
import { ProjectSheet } from "../../projects/ProjectSheet";
import { SettingsRow } from "./SettingsRow";

export interface ProjectFieldProps {
  projectId: string | null;
  projects: Project[];
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  onChange: (projectId: string | null) => void;
  variant?: "panel" | "screen";
}

export function ProjectField({
  projectId,
  projects: propProjects,
  projectsStatus = "ready",
  onRetryProjects,
  onChange,
  variant = "panel",
}: ProjectFieldProps): ReactElement {
  const [creating, setCreating] = useState(false);
  const [localProjects, setLocalProjects] = useState<Project[]>([]);

  const projects = [...propProjects];
  for (const lp of localProjects) {
    if (!projects.some((p) => p.id === lp.id)) {
      projects.push(lp);
    }
  }

  const knownProject = projectId
    ? projects.find((p) => p.id === projectId)
    : undefined;
  const isProjectInList = projectId === null || knownProject !== undefined;
  const isNormal = projectsStatus === "ready" && isProjectInList;
  const disabled = !isNormal;

  const fallbackLabel =
    projectId === null
      ? t("project.none")
      : (knownProject?.name ?? t("project.load_failed"));

  const options = isNormal
    ? [
        { value: "", label: t("project.none") },
        ...projects.map((p) => ({
          value: p.id,
          label: p.name,
          leading: <ProjectDot colour={p.colour} />,
        })),
        {
          value: "__new__",
          label: t("project.new_option"),
          leading: <PlusIcon size={16} />,
        },
      ]
    : [
        {
          value: projectId ?? "",
          label: fallbackLabel,
          leading: knownProject ? (
            <ProjectDot colour={knownProject.colour} />
          ) : undefined,
        },
      ];

  const handleSelect = (val: string) => {
    if (val === "__new__") {
      setCreating(true);
      return;
    }
    onChange(val ? val : null);
  };

  const handleCreated = (newProject: Project) => {
    setLocalProjects((prev) => [...prev, newProject]);
    onChange(newProject.id);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agendal:projects-changed"));
    }
    setCreating(false);
  };

  const control = (
    <Picker<string>
      id="task-project"
      label={t("task.project")}
      value={projectId ?? ""}
      options={options}
      disabled={disabled}
      onChange={handleSelect}
      variant={variant}
    />
  );

  const helper = disabled ? (
    <span className="flex items-center justify-between gap-2 pt-1">
      <span>{t("project.load_failed")}</span>
      {onRetryProjects && (
        <Button variant="secondary" size="sm" onClick={onRetryProjects}>
          {t("common.retry")}
        </Button>
      )}
    </span>
  ) : undefined;

  return (
    <>
      <SettingsRow
        variant={variant}
        icon={<FolderIcon size={18} />}
        tileBg="bg-project-blue/15 text-project-blue"
        label={t("task.project")}
        control={control}
        helper={helper}
        helperId="task-project-helper"
      />
      {/* New task keeps this field in its form: forms can't nest, and a submit here must not add the task */}
      {creating &&
        createPortal(
          <div onSubmit={(e) => e.stopPropagation()}>
            <ProjectSheet
              open
              projects={projects}
              onCreate={createProject}
              onCreated={handleCreated}
              onClose={() => setCreating(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
