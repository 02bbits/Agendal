import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { t } from "../../../copy";
import { useTaskStore } from "../store";
import { ChoiceField, type ChoiceOption } from "./ChoiceField";

export interface ProjectFieldProps {
  projectId: string | null;
  projectsStatus?: "ready" | "failed";
  onRetryProjects?: () => void;
  onChange: (projectId: string | null) => void;
}

export function ProjectField({
  projectId,
  projectsStatus = "ready",
  onRetryProjects,
  onChange,
}: ProjectFieldProps): ReactElement {
  const store = useTaskStore();
  const knownProject = projectId
    ? store.projects.find((p) => p.id === projectId)
    : undefined;
  const isProjectInList = projectId === null || knownProject !== undefined;
  const isNormal = projectsStatus === "ready" && isProjectInList;

  const disabled = !isNormal;

  const fallbackLabel =
    projectId === null
      ? t("project.none")
      : (knownProject?.name ?? t("project.load_failed"));

  const options: readonly ChoiceOption<string>[] = isNormal
    ? [
        { value: "", label: t("project.none") },
        ...store.projects.map((p) => ({ value: p.id, label: p.name })),
      ]
    : [{ value: projectId ?? "", label: fallbackLabel }];

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
    <ChoiceField<string>
      id="task-project"
      label={t("task.project")}
      value={projectId ?? ""}
      options={options}
      disabled={disabled}
      helper={helper}
      onChange={(v) => onChange(v ? v : null)}
    />
  );
}
