import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { FolderIcon } from "../../../components/icons";
import { Picker } from "../../../components/Picker";
import { ProjectDot } from "../../../components/ProjectDot";
import { t } from "../../../copy";
import type { Project } from "../../../domain/types";
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
  projects,
  projectsStatus = "ready",
  onRetryProjects,
  onChange,
  variant = "panel",
}: ProjectFieldProps): ReactElement {
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

  const control = (
    <Picker<string>
      id="task-project"
      label={t("task.project")}
      value={projectId ?? ""}
      options={options}
      disabled={disabled}
      onChange={(val) => onChange(val ? val : null)}
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
    <SettingsRow
      variant={variant}
      icon={<FolderIcon size={18} />}
      tileBg="bg-project-blue/15 text-project-blue"
      label={t("task.project")}
      control={control}
      helper={helper}
      helperId="task-project-helper"
    />
  );
}
