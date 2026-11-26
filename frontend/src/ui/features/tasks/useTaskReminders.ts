import { useEffect, useRef } from "react";
import type { Task } from "../../domain/types";
import { addReminderAlert } from "../reminders/reminderAlertStore";
import { t } from "../../copy";
import { now } from "@/lib/clock";

function parseOffsetMinutes(rem: string | null | undefined): number | null {
  if (!rem || rem === "none" || rem === "") return null;
  if (rem === "0m") return 0;
  const match = String(rem).match(/^(\d+)([mhdw])$/);
  if (!match) return null;
  const val = Number(match[1]);
  const unit = match[2];
  if (unit === "m") return val;
  if (unit === "h") return val * 60;
  if (unit === "d") return val * 1440;
  if (unit === "w") return val * 10080;
  return null;
}

function getRemindTimestamp(
  dateStr: string,
  timeStr: string | null,
  defaultTime: string,
  offsetMinutes: number,
): number | null {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const time = timeStr || defaultTime;
  const [hr, mn] = time.split(":").map(Number);
  if (isNaN(hr ?? NaN) || isNaN(mn ?? NaN)) return null;

  const targetDate = new Date(y, m - 1, d, hr, mn, 0, 0);
  return targetDate.getTime() - offsetMinutes * 60 * 1000;
}

/**
 * Periodically checks tasks in the store while using the app (#186).
 * When a task reaches its reminder time, it triggers an alert immediately.
 */
export function useTaskReminders(tasks: readonly Task[]): void {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      const currentMs = now().getTime();

      for (const task of tasks) {
        if (task.done) continue;

        // 1. Start date reminder
        if (task.start_date && task.reminder && task.reminder !== "none") {
          const offset = parseOffsetMinutes(task.reminder);
          if (offset !== null) {
            const remindTime = getRemindTimestamp(
              task.start_date,
              task.start_time,
              "09:00",
              offset,
            );
            // Alert if remindTime has passed within the last 2 hours (not ancient)
            if (
              remindTime !== null &&
              currentMs >= remindTime &&
              currentMs - remindTime < 2 * 60 * 60 * 1000
            ) {
              const key = `inapp-rem-${task.id}-start-${task.start_date}-${task.reminder}`;
              if (!firedRef.current.has(key)) {
                try {
                  if (sessionStorage.getItem("agendal.fired." + key)) {
                    firedRef.current.add(key);
                  } else {
                    firedRef.current.add(key);
                    sessionStorage.setItem("agendal.fired." + key, "1");
                    addReminderAlert({
                      id: `task-${task.id}`,
                      title: task.title,
                      body: t("task.start_date"),
                      url: `/tasks/${task.id}`,
                    });
                  }
                } catch {
                  firedRef.current.add(key);
                }
              }
            }
          }
        }

        // 2. Due date reminder
        if (task.due_date) {
          const dueOffsetStr =
            task.due_reminder && task.due_reminder !== "none"
              ? task.due_reminder
              : !task.start_date && task.reminder !== "none"
                ? task.reminder
                : null;
          if (dueOffsetStr) {
            const offset = parseOffsetMinutes(dueOffsetStr);
            if (offset !== null) {
              const remindTime = getRemindTimestamp(
                task.due_date,
                task.due_time,
                "21:00",
                offset,
              );
              if (
                remindTime !== null &&
                currentMs >= remindTime &&
                currentMs - remindTime < 2 * 60 * 60 * 1000
              ) {
                const key = `inapp-rem-${task.id}-due-${task.due_date}-${dueOffsetStr}`;
                if (!firedRef.current.has(key)) {
                  try {
                    if (sessionStorage.getItem("agendal.fired." + key)) {
                      firedRef.current.add(key);
                    } else {
                      firedRef.current.add(key);
                      sessionStorage.setItem("agendal.fired." + key, "1");
                      addReminderAlert({
                        id: `task-${task.id}`,
                        title: task.title,
                        body: t("task.due"),
                        url: `/tasks/${task.id}`,
                      });
                    }
                  } catch {
                    firedRef.current.add(key);
                  }
                }
              }
            }
          }
        }
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [tasks]);
}
