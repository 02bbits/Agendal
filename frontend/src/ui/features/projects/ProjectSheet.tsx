import { useId, useState } from "react";
import { t, type CopyKey } from "../../copy";
import { CheckIcon } from "../../components/icons";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/TextField";
import {
  PROJECT_COLOR_ORDER,
  PROJECT_LIMIT,
  PROJECT_NAME_MAX,
  defaultProjectColour,
  projectNameError,
  projectNameValid,
} from "../../domain/projects";
import type { Project, ProjectColor } from "../../domain/types";
import { now } from "../../../lib/clock";
import { uuidv7 } from "../../../lib/uuid";

export interface ProjectSheetProps {
  open: boolean;
  projects?: readonly Project[];
  /** When editing an existing project, pass it here */
  project?: Project | null;
  onClose: () => void;
  /** Gets the new project: open it, or select it in the picker that opened the sheet (PJ-1). */
  onCreate?(project: {
    id: string;
    name: string;
    colour: ProjectColor;
  }): Promise<Project> | Project;
  onUpdate?(
    id: string,
    patch: { name: string; colour: ProjectColor },
  ): Promise<Project> | Project;
  onCreated?: (project: Project) => void;
  onUpdated?: (project: Project) => void;
  clock?: { now: () => Date };
}

/** New project / Rename project: name and one of 8 colours. */
export function ProjectSheet({
  open,
  projects = [],
  project,
  onClose,
  onCreate,
  onUpdate,
  onCreated,
  onUpdated,
  clock,
}: ProjectSheetProps) {
  const isEdit = Boolean(project);
  const [name, setName] = useState(project ? project.name : "");
  const [colour, setColour] = useState(function () {
    return project ? project.colour : defaultProjectColour(projects);
  });
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const colourName = useId();
  const atLimit = !isEdit && projects.length >= PROJECT_LIMIT;
  const taken = projectNameError(name, projects, project?.id);
  const error = atLimit
    ? t("project.limit")
    : serverError
      ? serverError
      : touched && taken
        ? t(taken, { name: name.trim() })
        : undefined;
  const valid = !atLimit && !submitting && projectNameValid(name) && !taken;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setSubmitting(true);
    setServerError(null);

    const currentDate = clock?.now?.() ?? now();
    const projectPayload = {
      name: name.trim(),
      colour,
    };

    try {
      if (isEdit && project) {
        if (onUpdate) {
          const updated = await onUpdate(project.id, projectPayload);
          onUpdated?.(updated);
        } else {
          onUpdated?.({
            ...project,
            ...projectPayload,
          });
        }
      } else {
        const newProjectData = {
          id: uuidv7(currentDate),
          ...projectPayload,
        };
        if (onCreate) {
          const created = await onCreate(newProjectData);
          onCreated?.(created);
        } else {
          onCreated?.({
            ...newProjectData,
            created_at: currentDate.toISOString(),
          });
        }
      }
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setServerError(String((err as { message: string }).message));
      } else {
        setServerError(t("error.save_failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      title={isEdit ? t("project.rename") : t("project.new")}
      closeLabel={t("common.close")}
      confirmLabel={isEdit ? t("common.save") : t("common.create")}
      confirmDisabled={!valid}
      onConfirm={submit}
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label={t("project.name")}
          value={name}
          maxLength={PROJECT_NAME_MAX}
          autoComplete="off"
          enterKeyHint="done"
          disabled={atLimit || submitting}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setServerError(null);
          }}
          onBlur={() => setTouched(true)}
        />
        <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0 [&>legend]:mb-1.5 [&>legend]:p-0">
          <legend className="text-footnote font-medium text-ink-secondary">
            {t("project.colour")}
          </legend>
          {PROJECT_COLOR_ORDER.map((c) => (
            <label
              key={c}
              className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-white has-checked:shadow-[0_0_0_2px_var(--color-base-100),0_0_0_4px_var(--color-base-content)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary [&>input]:absolute [&>input]:inset-0 [&>input]:m-0 [&>input]:cursor-pointer [&>input]:opacity-0"
              style={{ background: `var(--color-project-${c})` }}
            >
              <input
                type="radio"
                name={colourName}
                value={c}
                checked={colour === c}
                onChange={() => setColour(c)}
                aria-label={t(`colour.${c}` as CopyKey)}
              />
              {colour === c && <CheckIcon size={16} strokeWidth={2.5} />}
            </label>
          ))}
        </fieldset>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
