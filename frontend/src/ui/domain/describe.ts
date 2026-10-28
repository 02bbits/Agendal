import { t, type CopyKey } from "../copy";
import { formatDay, formatTimeRange } from "./dates";
import type { Project, Task, TimeFormat } from "./types";

/** Accessible name of a task row (A11Y-51): "{title}, {due}, {time}, {project}, {priority} priority, reminder set, repeats {repeat}". */
export function taskAccessibleName(
  task: Task,
  project: Project | null | undefined,
  opts: { today: string; timeFormat: TimeFormat; showDue: boolean },
): string {
  const parts: string[] = [task.title];
  if (opts.showDue && task.due_date)
    parts.push(formatDay(task.due_date, opts.today));
  if (task.start_time)
    parts.push(
      formatTimeRange(task.start_time, task.end_time, opts.timeFormat),
    );
  parts.push(project ? project.name : t("project.none"));
  if (task.priority !== "low")
    parts.push(
      t("task.priority_named", {
        priority: t(`priority.${task.priority}` as CopyKey),
      }),
    );
  if (task.reminder !== "none") parts.push(t("task.reminder_set"));
  if (task.repeat !== "never")
    parts.push(
      t("task.repeats", {
        repeat: t(`repeat.${task.repeat}` as CopyKey).toLowerCase(),
      }),
    );
  return parts.join(", ");
}
