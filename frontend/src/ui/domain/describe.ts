import { t, type CopyKey } from "../copy";
import type { EntryKind } from "./entries";
import { describeRepeat } from "./repeat";
import { repeatLabel, rowMeta } from "./rowMeta";
import type { Project, Task, TimeFormat } from "./types";

/**
 * Accessible name of a task row (A11Y-51): what the row shows ("{title}, {project}, {meta parts},
 * {repeat}"), then what only its icons say ("{priority} priority, reminder set, repeats {repeat}").
 */
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
  // What the row shows, in its order, so the name starts with the visible text (WCAG 2.5.3)
  const parts: string[] = [
    task.title,
    project ? project.name : t("project.none"),
    ...rowMeta(task, opts).map((part) => part.text),
  ];
  if (task.repeat !== "never" && !task.done) parts.push(repeatLabel(task));
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
