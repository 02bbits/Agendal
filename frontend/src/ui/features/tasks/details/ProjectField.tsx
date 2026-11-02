import type { ReactElement } from "react";
import { Button } from "../../../components/Button";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
} from "../../../components/icons";
import { cx } from "../../../components/cx";
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
        ...projects.map((p) => ({ value: p.id, label: p.name })),
      ]
    : [{ value: projectId ?? "", label: fallbackLabel }];

  const dotColour = knownProject ? knownProject.colour : "gray";
  const isScreen = variant === "screen";

  const control = (
    <div className="relative inline-flex items-center">
      {knownProject && !isScreen && (
        <span
          className="pointer-events-none absolute left-2.5 z-10 size-2 rounded-full"
          style={{ background: `var(--color-project-${dotColour})` }}
          aria-hidden="true"
        />
      )}
      <select
        id="task-project"
        aria-label={t("task.project")}
        value={projectId ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        className={cx(
          "focus-ring cursor-pointer appearance-none border-0 text-ink focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
          isScreen
            ? "bg-transparent py-1 pr-5 text-right text-body text-ink-secondary"
            : cx(
                "rounded-full bg-fill py-1 pr-6 text-footnote font-medium",
                knownProject ? "pl-6" : "pl-3",
              ),
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {isScreen ? (
        <ChevronRightIcon
          size={16}
          className="pointer-events-none absolute right-0 text-ink-tertiary"
        />
      ) : (
        <ChevronDownIcon
          size={14}
          className="pointer-events-none absolute right-2 text-ink-secondary"
        />
      )}
    </div>
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
