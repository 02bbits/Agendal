import type { ReactElement } from "react";
import { cx } from "../../../components/cx";
import { CheckIcon, ChevronLeftIcon } from "../../../components/icons";
import { t } from "../../../copy";
import type { Project, Task } from "../../../domain/types";
import { useTaskStore } from "../store";
import { PanelHeader } from "./PanelHeader";
import { TitleField } from "./TitleField";

export interface TaskHeaderProps {
  task: Task;
  onSaveTitle: (title: string) => void;
  onBack: () => void;
  onClose?: () => void;
  backLabel?: string;
  variant?: "panel" | "screen";
  project?: Project | null;
  autoFocusTitle?: boolean;
}

export function TaskHeader({
  task,
  onSaveTitle,
  onBack,
  onClose,
  backLabel,
  variant = "panel",
  project,
  autoFocusTitle,
}: TaskHeaderProps): ReactElement {
  const store = useTaskStore();
  const isScreen = variant === "screen";

  const checkbox = (
    <button
      type="button"
      role="checkbox"
      aria-checked={task.done}
      aria-label={t(task.done ? "task.reopen" : "task.complete", {
        title: task.title,
      })}
      className={cx(
        "group/check mt-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-paper focus-visible:outline-none",
        task.done && "is-done",
      )}
      onClick={() => store.toggle(task)}
    >
      <span
        className="inline-flex size-[22px] items-center justify-center rounded-full shadow-[inset_0_0_0_2px_var(--color-ink-tertiary)] group-[.is-overdue]/task:shadow-[inset_0_0_0_2px_var(--color-error)] group-aria-checked/check:bg-ink group-aria-checked/check:shadow-none group-focus-visible/check:outline-2 group-focus-visible/check:outline-offset-2 group-focus-visible/check:outline-primary"
        aria-hidden="true"
      >
        {task.done && <CheckIcon size={14} strokeWidth={2.5} />}
      </span>
    </button>
  );

  return (
    <div>
      {isScreen ? (
        <div className="flex h-11 items-center justify-between border-b border-separator px-4">
          <button
            type="button"
            className="focus-ring inline-flex items-center gap-1 text-callout font-medium text-primary hover:underline underline-offset-2"
            onClick={onBack}
          >
            <ChevronLeftIcon size={18} />
            <span>{backLabel ?? t("common.back")}</span>
          </button>
        </div>
      ) : (
        <PanelHeader onClose={onClose ?? onBack} />
      )}

      <div className="px-4 pt-4">
        <div className="flex items-start gap-3">
          {checkbox}
          <div className="min-w-0 flex-1">
            <TitleField
              value={task.title}
              onSave={onSaveTitle}
              variant={variant}
              autoFocusTitle={autoFocusTitle}
            />
          </div>
        </div>

        {isScreen && project && (
          <div className="mt-1 flex items-center gap-1.5 pl-9 text-footnote text-ink-secondary">
            <span
              className="size-2 rounded-full"
              style={{ background: `var(--color-project-${project.colour})` }}
              aria-hidden="true"
            />
            <span>{project.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
