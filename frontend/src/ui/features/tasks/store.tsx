import { notifyTaskCreated } from "../../domain/appEvents";
import * as React from "react";
import { CheckCircleIcon } from "../../components/icons";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import { formatDay } from "../../domain/dates";
import type { Task } from "../../domain/types";
import { reopenSeriesChanges } from "../../domain/series";
import type { DeleteScope } from "../../domain/api";
import * as types from "./types";
import { useMergeBack } from "./useMergeBack";
import { useTaskEdit } from "./useTaskEdit";
import { useTaskOrder } from "./useTaskOrder";
import { useTaskSync } from "./useTaskSync";
import { useTaskReminders } from "./useTaskReminders";
import { createZoneFormatter, useToday } from "./useToday";

export * from "./types";
export * from "./useTaskEdit";
export * from "./useTaskSync";

const Ctx = React.createContext<types.TaskStore | null>(null);

export function useTaskStore(): types.TaskStore {
  const store = React.useContext(Ctx);
  if (!store) throw new Error("useTaskStore needs a <TaskStoreProvider>");
  return store;
}

/** The store when there is one: a row drawn outside a provider (Search, tests) has none. */
export function useOptionalTaskStore(): types.TaskStore | null {
  return React.useContext(Ctx);
}

/** The open row of `task`'s series, to light up when it goes back in: by the chain, else by name. */
function seriesOpenRow(rows: readonly Task[], task: Task): Task | undefined {
  const open = rows.filter((row) => !row.done && row.id !== task.id);
  return (
    open.find((row) => row.previous_occurrence_id === task.id) ??
    open.find(
      (row) =>
        row.title === task.title &&
        row.project_id === task.project_id &&
        row.repeat === task.repeat,
    )
  );
}

export function TaskStoreProvider({
  api,
  clock,
  initialTasks,
  initialProjects,
  timeFormat = "24h",
  onToast,
  mergeMotion = false,
  children,
}: types.TaskStoreProviderProps) {
  const {
    tasks,
    change,
    getTask,
    acceptOccurrence,
    removeRow,
    insertRow,
    replaceRows,
  } = useTaskSync(initialTasks);
  useTaskReminders(tasks);
  const [projects, setProjects] = React.useState(initialProjects);
  // A project made from a picker reaches the rows when the screen refetches
  const projectsKey = JSON.stringify(initialProjects);
  const [seenProjects, setSeenProjects] = React.useState(projectsKey);
  if (projectsKey !== seenProjects) {
    setSeenProjects(projectsKey);
    setProjects(initialProjects);
  }
  const [toast, setToast] = React.useState<ToastData | null>(null);
  const [settling, setSettling] = React.useState<types.SettleSet>(new Set());
  const toastSeq = React.useRef(0);
  const merge = useMergeBack(mergeMotion);
  // Occurrences withdrawn by a reopen: their series still knows they followed a row
  const withdrawnRows = React.useRef<Map<string, Task>>(new Map());
  const settleTimers = React.useRef<types.SettleTimerMap>(new Map());
  const pendingOccurrences = React.useRef<Map<string, Task>>(new Map());
  const lifecycleRef = React.useRef<types.LifecycleFn>(() => {});
  const toggleRef = React.useRef<(task: Task) => void>(() => {});
  const removeRef = React.useRef<(task: Task, scope?: DeleteScope) => void>(
    () => {},
  );
  const restoreRef = React.useRef<(task: Task, madeNextId?: string) => void>(
    () => {},
  );

  React.useEffect(
    () => () => {
      settleTimers.current.forEach(clearTimeout);
      settleTimers.current.clear();
      pendingOccurrences.current.clear();
    },
    [],
  );

  const todayDate = useToday(clock);
  const dateFormatter = React.useMemo(
    () => createZoneFormatter(clock.timeZone),
    [clock.timeZone],
  );

  const completedToday = React.useCallback(
    (task: Task) =>
      Boolean(
        task.done_at &&
        dateFormatter.format(new Date(task.done_at)) === todayDate,
      ),
    [dateFormatter, todayDate],
  );

  const showToast = React.useCallback(
    (d: types.ToastDraft) =>
      onToast ? onToast(d) : setToast({ ...d, id: ++toastSeq.current }),
    [onToast],
  );
  const dismissToast = React.useCallback(
    (id: ToastData["id"]) => setToast((c) => (c?.id === id ? null : c)),
    [],
  );

  const clearSettle = React.useCallback((id: string) => {
    const timer = settleTimers.current.get(id);
    if (timer) clearTimeout(timer);
    settleTimers.current.delete(id);
    pendingOccurrences.current.delete(id);
    setSettling((s) =>
      s.has(id) ? new Set([...s].filter((x) => x !== id)) : s,
    );
  }, []);

  const settle = React.useCallback(
    (id: string) => {
      clearSettle(id);
      setSettling((s) => new Set(s).add(id));
      settleTimers.current.set(
        id,
        setTimeout(() => {
          settleTimers.current.delete(id);
          setSettling((s) => new Set([...s].filter((x) => x !== id)));
          const pending = pendingOccurrences.current.get(id);
          if (pending) {
            pendingOccurrences.current.delete(id);
            acceptOccurrence(pending, false);
          }
        }, types.SETTLE_MS),
      );
    },
    [acceptOccurrence, clearSettle],
  );

  const handleSaveError = React.useCallback(
    (err: unknown, retry: () => void) =>
      showToast(types.formatSaveErrorToast(err, retry)),
    [showToast],
  );

  const mutateLifecycle = React.useCallback(
    (id: string, action: types.LifecycleAction) => {
      const at = clock.now().toISOString();
      const isComplete = action === "complete";
      if (isComplete) {
        settle(id);
        const row = getTask(id);
        showToast({
          message: t("task.completed", { title: row?.title ?? "" }),
          icon: <CheckCircleIcon size={18} />,
          actionLabel: t("common.undo"),
          onAction: () => lifecycleRef.current(id, "reopen"),
        });
      } else {
        clearSettle(id);
      }
      // Reopened: a series keeps one open occurrence. What the server does to the others shows now,
      // not after the answer, so the list never shows two open for a moment (#168)
      const series = isComplete
        ? { withdraw: [], close: [] }
        : reopenSeriesChanges(tasks, [...withdrawnRows.current.values()], id);
      series.withdraw.forEach((row) => {
        withdrawnRows.current.set(row.id, row);
        removeRow(row.id);
      });
      series.close.forEach((row) =>
        insertRow({ ...row, done: true, done_at: at }),
      );

      const fields = isComplete
        ? { done: true, done_at: at }
        : { done: false, done_at: null };
      const req = () =>
        (isComplete ? api.complete(id, at) : api.reopen(id, at)).then((r) => {
          // Requests for one task run in order, so every answer is applied:
          // complete adds the next occurrence, reopen removes the one the
          // server deleted. Skipping a stale answer left a duplicate row
          if (r.next) {
            if (isComplete && settleTimers.current.has(id)) {
              pendingOccurrences.current.set(id, r.next);
            } else {
              acceptOccurrence(r.next, !isComplete);
            }
          }
          r.withdrawn?.forEach(removeRow);
          // An earlier occurrence that was open is done again
          r.closed?.forEach(insertRow);
          return r.task;
        });
      change(id, fields, req, (err) => {
        series.withdraw.forEach((row) => {
          withdrawnRows.current.delete(row.id);
          insertRow(row);
        });
        series.close.forEach(insertRow);
        handleSaveError(err, () => lifecycleRef.current(id, action));
      });
    },
    [
      api,
      acceptOccurrence,
      change,
      clearSettle,
      clock,
      getTask,
      handleSaveError,
      insertRow,
      removeRow,
      settle,
      showToast,
      tasks,
    ],
  );

  React.useEffect(() => {
    lifecycleRef.current = mutateLifecycle;
  }, [mutateLifecycle]);

  // Unticked in a Completed list (#168): an older done repeat goes back into its series (removed,
  // the open one stays as it is); the latest done one is reopened on its own date, so a tick by
  // mistake rolls back
  const untickRepeat = React.useCallback(
    (task: Task) => {
      const at = clock.now().toISOString();
      const dayOf = (row: Task) => {
        const day = row.due_date ?? row.start_date;
        return day ? formatDay(day, todayDate) : row.title;
      };
      merge.mergeBack(
        task.id,
        () => api.reopen(task.id, at, { merge: true }),
        (r) => {
          if (r.merged) {
            removeRow(task.id);
            showToast({
              message: t("task.merged_back", { date: dayOf(task) }),
              actionLabel: t("common.undo"),
              onAction: () => restoreRef.current(task),
            });
            return seriesOpenRow(tasks, task)?.id ?? null;
          }
          insertRow(r.task);
          if (r.next) acceptOccurrence(r.next, true);
          r.withdrawn?.forEach(removeRow);
          r.closed?.forEach(insertRow);
          // The latest done one, ticked by mistake: back to its own date, the next one gone
          showToast({
            message: t("task.back_to", { date: dayOf(task) }),
            actionLabel: t("common.undo"),
            onAction: () => lifecycleRef.current(task.id, "complete"),
          });
          return task.id;
        },
        (err) => handleSaveError(err, () => toggleRef.current(task)),
      );
    },
    [
      acceptOccurrence,
      api,
      clock,
      handleSaveError,
      insertRow,
      merge,
      removeRow,
      showToast,
      tasks,
      todayDate,
    ],
  );

  const toggle = React.useCallback(
    (task: Task) => {
      // A task that is settling after Complete ignores more clicks on its
      // tick until it moves down; Undo in the toast still reopens it
      if (settleTimers.current.has(task.id)) return;
      if (merge.isBusy(task.id)) return;
      if (task.done && task.repeat !== "never") untickRepeat(task);
      else mutateLifecycle(task.id, task.done ? "reopen" : "complete");
    },
    [merge, mutateLifecycle, untickRepeat],
  );

  React.useEffect(() => {
    toggleRef.current = toggle;
  }, [toggle]);

  const toggleInPlace = React.useCallback(
    (task: Task) => {
      if (settleTimers.current.has(task.id)) return;
      mutateLifecycle(task.id, task.done ? "reopen" : "complete");
    },
    [mutateLifecycle],
  );

  const { update } = useTaskEdit({
    getTask,
    change,
    api,
    clock,
    todayDate,
    showToast,
    handleSaveError,
  });
  const reorder = useTaskOrder({
    api,
    clock,
    getTask,
    replaceRows,
    showToast,
  });

  const restore = React.useCallback(
    (task: Task, madeNextId?: string) => {
      if (madeNextId) {
        removeRow(madeNextId);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("agendal:task-deleted", {
              detail: { id: madeNextId },
            }),
          );
        }
      }
      insertRow(task);
      api.restore(task.id).then(
        (saved) => {
          insertRow(saved);
          if (typeof window !== "undefined") {
            notifyTaskCreated(saved);
          }
        },
        (err) => {
          removeRow(task.id);
          handleSaveError(err, () => restoreRef.current(task, madeNextId));
        },
      );
    },
    [api, handleSaveError, insertRow, removeRow],
  );

  const remove = React.useCallback(
    (task: Task, scope?: DeleteScope) => {
      const removedTasks: Task[] = [task];
      if (scope === "future" && task.repeat !== "never") {
        const seen = new Set<string>([task.id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const candidate of tasks) {
            if (seen.has(candidate.id)) continue;
            const isChild =
              candidate.previous_occurrence_id &&
              seen.has(candidate.previous_occurrence_id);
            const isParent = removedTasks.some(
              (r) => r.previous_occurrence_id === candidate.id,
            );
            if (isChild || isParent) {
              seen.add(candidate.id);
              removedTasks.push(candidate);
              grew = true;
            }
          }
        }
      }
      for (const removed of removedTasks) {
        removeRow(removed.id);
      }
      let madeNextId: string | undefined;
      let undone = false;
      let serverDeletedIds: string[] | undefined;
      showToast({
        message: t("task.deleted", { title: task.title }),
        actionLabel: t("common.undo"),
        onAction: () => {
          undone = true;
          if (scope === "future" && task.repeat !== "never") {
            for (const removed of removedTasks) {
              insertRow(removed);
            }
            const idsToRestore =
              serverDeletedIds ?? removedTasks.map((r) => r.id);
            void Promise.all(
              idsToRestore.map((id) =>
                api.restore(id).then((saved) => {
                  insertRow(saved);
                  if (typeof window !== "undefined") {
                    notifyTaskCreated(saved);
                  }
                }),
              ),
            ).catch((err) => {
              handleSaveError(err, () => restore(task, madeNextId));
            });
            return;
          }
          restore(task, madeNextId);
        },
      });
      if (typeof window !== "undefined") {
        for (const removed of removedTasks) {
          window.dispatchEvent(
            new CustomEvent("agendal:task-deleted", {
              detail: { id: removed.id },
            }),
          );
        }
      }
      api.remove(task.id, task.repeat === "never" ? undefined : scope).then(
        (res) => {
          if (undone) return;
          if (res && "next" in res && res.next) {
            madeNextId = res.next.id;
            insertRow(res.next);
            if (typeof window !== "undefined") {
              notifyTaskCreated(res.next);
            }
          }
          if (res && "deleted_ids" in res && Array.isArray(res.deleted_ids)) {
            serverDeletedIds = res.deleted_ids;
            for (const deletedId of res.deleted_ids) {
              removeRow(deletedId);
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("agendal:task-deleted", {
                    detail: { id: deletedId },
                  }),
                );
              }
            }
          }
        },
        (err) => {
          for (const removed of removedTasks) {
            insertRow(removed);
          }
          handleSaveError(err, () => removeRef.current(task, scope));
        },
      );
    },
    [api, handleSaveError, insertRow, removeRow, restore, showToast, tasks],
  );

  React.useEffect(() => {
    removeRef.current = remove;
    restoreRef.current = restore;
  }, [remove, restore]);

  const store: types.TaskStore = React.useMemo(
    () => ({
      tasks,
      projects,
      today: todayDate,
      timeFormat,
      clock,
      api,
      toast,
      showToast,
      dismissToast,
      projectOf: (task) =>
        projects.find((p) => p.id === task.project_id) ?? null,
      isSettling: (id) => settling.has(id),
      isLeaving: (id) => merge.leaving.has(id),
      isArriving: (id) => merge.arriving.has(id),
      completedToday,
      toggle,
      toggleInPlace,
      change,
      update,
      reorder,
      remove,
      restore,
      ensureTask: insertRow,
      setProjects,
    }),
    [
      tasks,
      projects,
      todayDate,
      timeFormat,
      clock,
      api,
      toast,
      showToast,
      dismissToast,
      settling,
      merge.leaving,
      merge.arriving,
      completedToday,
      toggle,
      toggleInPlace,
      change,
      update,
      reorder,
      remove,
      restore,
      insertRow,
    ],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
