import * as React from "react";
import { CheckCircleIcon } from "../../components/icons";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import type { Task } from "../../domain/types";
import type { DeleteScope } from "../../domain/api";
import * as types from "./types";
import { useTaskEdit } from "./useTaskEdit";
import { useTaskSync } from "./useTaskSync";
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

export function TaskStoreProvider({
  api,
  clock,
  initialTasks,
  initialProjects,
  timeFormat = "24h",
  children,
}: types.TaskStoreProviderProps) {
  const { tasks, change, getTask, acceptOccurrence, removeRow, insertRow } =
    useTaskSync(initialTasks);
  const [projects, setProjects] = React.useState(initialProjects);
  const [toast, setToast] = React.useState<ToastData | null>(null);
  const [settling, setSettling] = React.useState<types.SettleSet>(new Set());
  const toastSeq = React.useRef(0);
  const settleTimers = React.useRef<types.SettleTimerMap>(new Map());
  const lifecycleRef = React.useRef<types.LifecycleFn>(() => {});
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
    (d: types.ToastDraft) => setToast({ ...d, id: ++toastSeq.current }),
    [],
  );
  const dismissToast = React.useCallback(
    (id: ToastData["id"]) => setToast((c) => (c?.id === id ? null : c)),
    [],
  );

  const clearSettle = React.useCallback((id: string) => {
    const timer = settleTimers.current.get(id);
    if (timer) clearTimeout(timer);
    settleTimers.current.delete(id);
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
        }, types.SETTLE_MS),
      );
    },
    [clearSettle],
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

      const fields = isComplete
        ? { done: true, done_at: at }
        : { done: false, done_at: null };
      const req = () =>
        (isComplete ? api.complete(id, at) : api.reopen(id, at)).then((r) => {
          // Requests for one task run in order, so every answer is applied:
          // complete adds the next occurrence, reopen removes the one the
          // server deleted. Skipping a stale answer left a duplicate row
          if (r.next) acceptOccurrence(r.next, !isComplete);
          return r.task;
        });
      change(id, fields, req, (err) =>
        handleSaveError(err, () => lifecycleRef.current(id, action)),
      );
    },
    [
      api,
      acceptOccurrence,
      change,
      clearSettle,
      clock,
      getTask,
      handleSaveError,
      settle,
      showToast,
    ],
  );

  React.useEffect(() => {
    lifecycleRef.current = mutateLifecycle;
  }, [mutateLifecycle]);

  const toggle = React.useCallback(
    (task: Task) => {
      // A task that is settling after Complete ignores more clicks on its
      // tick until it moves down; Undo in the toast still reopens it
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

  const restore = React.useCallback(
    (task: Task, madeNextId?: string) => {
      if (madeNextId) removeRow(madeNextId);
      insertRow(task);
      api.restore(task.id).then(
        (saved) => {
          insertRow(saved);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("agendal:task-created", { detail: saved }),
            );
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
      removeRow(task.id);
      let madeNextId: string | undefined;
      showToast({
        message: t("task.deleted", { title: task.title }),
        actionLabel: t("common.undo"),
        onAction: () => restore(task, madeNextId),
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("agendal:task-deleted", { detail: { id: task.id } }),
        );
      }
      api.remove(task.id, task.repeat === "never" ? undefined : scope).then(
        (res) => {
          if (res && "next" in res && res.next) {
            madeNextId = res.next.id;
            insertRow(res.next);
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("agendal:task-created", { detail: res.next }),
              );
            }
          }
        },
        (err) => {
          insertRow(task);
          handleSaveError(err, () => removeRef.current(task, scope));
        },
      );
    },
    [api, handleSaveError, insertRow, removeRow, restore, showToast],
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
      completedToday,
      toggle,
      change,
      update,
      remove,
      restore,
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
      completedToday,
      toggle,
      change,
      update,
      remove,
      restore,
    ],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
