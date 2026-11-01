import type { ReactElement } from "react";
import { CheckIcon } from "../../../components/icons";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import type { Task } from "../../../domain/types";
import type { Navigate } from "../../shell/routes";
import { useTaskStore } from "../store";
import { AssistantTag } from "./AssistantTag";
import { TitleField } from "./TitleField";

export interface TaskHeaderProps {
  task: Task;
  onSaveTitle: (title: string) => void;
  sourceNote?: { name: string; href: string };
  navigate?: Navigate;
}

export function TaskHeader({
  task,
  onSaveTitle,
  sourceNote,
  navigate,
}: TaskHeaderProps): ReactElement {
  const store = useTaskStore();

  return (
    <div>
      <div className="mt-2 flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={t(task.done ? "task.reopen" : "task.complete", {
            title: task.title,
          })}
          className={cx(
            "group/check mt-7 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-paper focus-visible:outline-none",
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
        <div className="min-w-0 flex-1">
          <TitleField value={task.title} onSave={onSaveTitle} />
        </div>
      </div>

      <div className="mt-2 ml-14">
        <AssistantTag
          createdBy={task.created_by}
          sourceNote={sourceNote}
          navigate={navigate}
        />
      </div>
    </div>
  );
}
