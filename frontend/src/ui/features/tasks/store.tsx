import * as React from "react";
import { CheckCircleIcon } from "../../components/icons";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import type { Task } from "../../domain/types";
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
  const { tasks, change, getTask } = useTaskSync(initialTasks);
  const [projects, setProjects] = React.useState(initialProjects);
  const [toast, setToast] = React.useState<ToastData | null>(null);
  const [settling, setSettling] = React.useState<types.SettleSet>(new Set());
  const toastSeq = React.useRef(0);
  const settleTimers = React.useRef<types.SettleTimerMap>(new Map());
  const lifecycleRef = React.useRef<types.LifecycleFn>(() => {});

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
        (isComplete ? api.complete(id, at) : api.reopen(id, at)).then(
          (r) => r.task,
        );
      change(id, fields, req, (err) =>
        handleSaveError(err, () => lifecycleRef.current(id, action)),
      );
    },
    [
      api,
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
    (task: Task) => mutateLifecycle(task.id, task.done ? "reopen" : "complete"),
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
    ],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
