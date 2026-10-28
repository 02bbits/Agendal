import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { t, type CopyKey } from "../../copy";
import { ChipGroup } from "../../components/ChipGroup";
import { FlagIcon } from "../../components/icons";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/TextField";
import { addDays, nextWeekStart } from "../../domain/dates";
import { TITLE_MAX } from "../../domain/edit";
import { PRIORITIES, type Priority } from "../../domain/types";
import { uuidv7 } from "../../domain/uuid";
import { useTaskStore } from "./store";

export type DueChoice = "today" | "tomorrow" | "next_week" | "none" | "pick";
/** Where the sheet opened; it sets the defaults (NC §2.5). */
export type NewTaskOrigin =
  | { from: "inbox" }
  | { from: "upcoming" }
  | { from: "project"; projectId: string }
  | { from: "other" };

const NO_PROJECT = "";
const NEW_PROJECT = "__new__";

export function defaultsFor(origin: NewTaskOrigin): {
  due: DueChoice;
  projectId: string | null;
} {
  if (origin.from === "inbox") return { due: "today", projectId: null };
  if (origin.from === "upcoming") return { due: "tomorrow", projectId: null };
  if (origin.from === "project")
    return { due: "none", projectId: origin.projectId };
  return { due: "none", projectId: null };
}

export interface NewTaskSheetProps {
  open: boolean;
  origin: NewTaskOrigin;
  onClose: () => void;
  /** "New project…" in the picker (PJ-1 from a picker). */
  onNewProject?: () => void;
}

/** New task by hand (NC-7): only a title is needed. */
export function NewTaskSheet({
  open,
  origin,
  onClose,
  onNewProject,
}: NewTaskSheetProps) {
  const store = useTaskStore();
  const defaults = defaultsFor(origin);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DueChoice>(defaults.due);
  const [picked, setPicked] = useState("");
  const [priority, setPriority] = useState<Priority>("low");
  const [projectId, setProjectId] = useState<string>(
    defaults.projectId ?? NO_PROJECT,
  );
  const projectFieldId = useId();
  const valid = title.trim().length > 0 && (due !== "pick" || picked !== "");

  const dueDate = (): string | null => {
    if (due === "today") return store.today;
    if (due === "tomorrow") return addDays(store.today, 1);
    if (due === "next_week") return nextWeekStart(store.today, store.weekStart);
    if (due === "pick") return picked || null;
    return null;
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!valid) return;
    store.create({
      id: uuidv7(store.clock.now().getTime()),
      title: title.trim(),
      due_date: dueDate(),
      priority,
      project_id: projectId || null,
    });
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
  };

  const dueOptions: Array<{ value: DueChoice; label: string }> = [
    { value: "today", label: t("date.today") },
    { value: "tomorrow", label: t("date.tomorrow") },
    { value: "next_week", label: t("task.next_week") },
    { value: "none", label: t("task.no_date") },
    { value: "pick", label: t("task.pick_date") },
  ];

  return (
    <Sheet
      open={open}
      title={t("task.new")}
      closeLabel={t("common.close")}
      confirmLabel={t("common.add")}
      confirmDisabled={!valid}
      onConfirm={submit}
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={submit}
        onKeyDown={onKeyDown}
      >
        <TextField
          label={t("task.title")}
          helper={t("task.title_only")}
          value={title}
          maxLength={TITLE_MAX}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
        />
        <ChipGroup
          label={t("task.due")}
          showLabel
          options={dueOptions}
          value={due}
          onChange={setDue}
        />
        {due === "pick" && (
          <TextField
            label={t("task.pick_date")}
            type="date"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          />
        )}
        <ChipGroup
          label={t("task.priority")}
          showLabel
          value={priority}
          onChange={setPriority}
          options={PRIORITIES.map((p) => ({
            value: p,
            label: t(`priority.${p}` as CopyKey),
            icon:
              p === "low" ? undefined : (
                <FlagIcon
                  size={14}
                  className={p === "high" ? "text-error" : "text-warning"}
                />
              ),
          }))}
        />
        <div className="flex flex-col gap-1.5">
          <label
            className="text-footnote font-medium text-ink-secondary"
            htmlFor={projectFieldId}
          >
            {t("task.project")}
          </label>
          <select
            id={projectFieldId}
            className="select focus-ring h-[52px] w-full rounded-field border-control bg-surface px-4 text-body text-ink"
            value={projectId}
            onChange={(e) =>
              e.target.value === NEW_PROJECT
                ? onNewProject?.()
                : setProjectId(e.target.value)
            }
          >
            <option value={NO_PROJECT}>{t("project.none")}</option>
            {store.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {onNewProject && (
              <option value={NEW_PROJECT}>{t("task.new_project")}</option>
            )}
          </select>
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
