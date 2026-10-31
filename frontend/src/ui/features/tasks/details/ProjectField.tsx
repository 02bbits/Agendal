import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import { useTaskStore } from "../store";
import { CONTROL_CLASS } from "./control";
import { Field } from "./Field";

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

  if (isNormal) {
    return (
      <Field id="task-project" label={t("task.project")}>
        <select
          id="task-project"
          value={projectId ?? ""}
          onChange={(e) => onChange(e.target.value ? e.target.value : null)}
          className={cx(
            CONTROL_CLASS,
            "focus-ring cursor-pointer border aria-invalid:border-error disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <option value="">{t("project.none")}</option>
          {store.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  const currentValue = projectId ?? "";
  const optionLabel = knownProject?.name ?? t("project.load_failed");
  const helperId = "task-project-helper";

  return (
    <Field
      id="task-project"
      label={t("task.project")}
      helperId={helperId}
      helper={
        <span className="flex items-center justify-between gap-2 pt-1">
          <span>{t("project.load_failed")}</span>
          {onRetryProjects && (
            <Button variant="secondary" size="sm" onClick={onRetryProjects}>
              {t("common.retry")}
            </Button>
          )}
        </span>
      }
    >
      <select
        id="task-project"
        value={currentValue}
        disabled
        aria-describedby={helperId}
        className={cx(
          CONTROL_CLASS,
          "focus-ring cursor-pointer border aria-invalid:border-error disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <option value={currentValue}>{optionLabel}</option>
      </select>
    </Field>
  );
}
