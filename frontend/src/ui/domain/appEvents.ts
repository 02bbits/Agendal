import type { Task } from "./types";

/** A task was made or saved (its detail is the task): lists and counts take it in. */
export const TASK_CREATED = "agendal:task-created";
/** A reminder was set, by hand or by a note: the app may ask to send notifications (TK §2.5). */
export const REMINDER_SET = "agendal:reminder-set";
/** A project was made, renamed, deleted or restored: the sidebar and lists fetch again. */
export const PROJECTS_CHANGED = "agendal:projects-changed";

export function notifyTaskCreated(task?: Task) {
  window.dispatchEvent(new CustomEvent(TASK_CREATED, { detail: task }));
}

export function notifyReminderSet() {
  window.dispatchEvent(new CustomEvent(REMINDER_SET));
}

export function notifyProjectsChanged() {
  window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED));
}
