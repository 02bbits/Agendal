import { t, type CopyKey } from "../copy";
import type { EntryKind } from "./entries";
import { describeRepeat } from "./repeat";
import { rowMeta } from "./rowMeta";
import type { Project, Task, TimeFormat } from "./types";

/** Accessible name of a task row (A11Y-51): "{title}, {meta parts}, {project}, {priority} priority, reminder set, repeats {repeat}". */
export function taskAccessibleName(
  task: Task,
  project: Project | null | undefined,
  opts: {
    today: string;
    timeFormat: TimeFormat;
    nowTime?: string;
    entry?: EntryKind;
  },
): string {
  const parts: string[] = [task.title];
  const meta = rowMeta(task, opts);
  for (const part of meta) {
    parts.push(part.text);
  }
  parts.push(project ? project.name : t("project.none"));
  if (task.priority === "medium" || task.priority === "high")
    parts.push(
      t("task.priority_named", {
        priority: t(`priority.${task.priority}` as CopyKey),
      }),
    );
  if (task.reminder !== "none") parts.push(t("task.reminder_set"));
  if (task.repeat !== "never")
    parts.push(
      t("task.repeats", {
        repeat:
          describeRepeat(task) ??
          t(`repeat.${task.repeat}` as CopyKey).toLowerCase(),
      }),
    );
  return parts.join(", ");
}
