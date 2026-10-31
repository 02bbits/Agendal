import * as React from "react";
import { CheckCircleIcon } from "../../components/icons";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import type { Task } from "../../domain/types";
import * as sync from "./useTaskSync";
import { createZoneFormatter, useToday } from "./useToday";

export * from "./useTaskSync";

const Ctx = React.createContext<sync.TaskStore | null>(null);

export function useTaskStore(): sync.TaskStore {
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
}: sync.TaskStoreProviderProps) {
  const { tasks, change, getTask } = sync.useTaskSync(initialTasks);
  const [projects, setProjects] = React.useState(initialProjects);
  const [toast, setToast] = React.useState<ToastData | null>(null);
  const [settling, setSettling] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const toastSeq = React.useRef(0);
  const settleTimers = React.useRef<sync.SettleTimerMap>(new Map());
  const lifecycleRef = React.useRef<sync.LifecycleFn>(() => {});

  React.useEffect(() => {
    const timers = settleTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const todayDate = useToday(clock);

  // Cached Intl.DateTimeFormat per time zone (same en-CA format as clock.today)
  // to avoid re-allocating a formatter instance on every task row check.
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
    (d: Omit<ToastData, "id">) => setToast({ ...d, id: ++toastSeq.current }),
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
      const nextTimer = setTimeout(() => {
        settleTimers.current.delete(id);
        setSettling((s) => new Set([...s].filter((x) => x !== id)));
      }, sync.SETTLE_MS);
      settleTimers.current.set(id, nextTimer);
    },
    [clearSettle],
  );

  const handleSaveError = React.useCallback(
    (error: unknown, retry: () => void) =>
      showToast(sync.formatSaveErrorToast(error, retry)),
    [showToast],
  );

  const mutateLifecycle = React.useCallback(
    (id: string, action: sync.LifecycleAction) => {
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

      change(
        id,
        isComplete
          ? { done: true, done_at: at }
          : { done: false, done_at: null },
        async () => {
          const res = await (isComplete
            ? api.complete(id, at)
            : api.reopen(id, at));
          // The next occurrence comes with IM-24 (#23).
          return res.task;
        },
        (error) => {
          handleSaveError(error, () => lifecycleRef.current(id, action));
        },
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

  const store = React.useMemo<sync.TaskStore>(
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
    ],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
