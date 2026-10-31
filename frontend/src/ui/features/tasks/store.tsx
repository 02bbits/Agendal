import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { today } from "../../../lib/clock";
import { CheckCircleIcon } from "../../components/icons";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import type { Task } from "../../domain/types";
import {
  formatSaveErrorToast,
  isTaskCompletedToday,
  SETTLE_MS,
  useTaskSync,
  type Clock,
  type LifecycleAction,
  type LifecycleFn,
  type SettleTimerMap,
  type TaskStore,
  type TaskStoreProviderProps,
} from "./useTaskSync";

export { SETTLE_MS, type Clock, type TaskStore, type TaskStoreProviderProps };

const Ctx = createContext<TaskStore | null>(null);

export function useTaskStore(): TaskStore {
  const store = useContext(Ctx);
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
}: TaskStoreProviderProps) {
  const { tasks, change, getTask } = useTaskSync(initialTasks);
  const [projects, setProjects] = useState(initialProjects);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [settling, setSettling] = useState<ReadonlySet<string>>(new Set());
  const toastSeq = useRef(0);
  const settleTimers = useRef<SettleTimerMap>(new Map());
  const lifecycleRef = useRef<LifecycleFn>(() => {});

  useEffect(() => {
    const timers = settleTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const todayDate = today(clock.timeZone, clock.now());
  const showToast = useCallback(
    (d: Omit<ToastData, "id">) => setToast({ ...d, id: ++toastSeq.current }),
    [],
  );
  const dismissToast = useCallback(
    (id: ToastData["id"]) => setToast((c) => (c?.id === id ? null : c)),
    [],
  );

  const clearSettle = useCallback((id: string) => {
    const timer = settleTimers.current.get(id);
    if (timer) clearTimeout(timer);
    settleTimers.current.delete(id);
    setSettling((s) =>
      s.has(id) ? new Set([...s].filter((x) => x !== id)) : s,
    );
  }, []);

  const settle = useCallback(
    (id: string) => {
      clearSettle(id);
      setSettling((s) => new Set(s).add(id));
      const nextTimer = setTimeout(() => {
        settleTimers.current.delete(id);
        setSettling((s) => new Set([...s].filter((x) => x !== id)));
      }, SETTLE_MS);
      settleTimers.current.set(id, nextTimer);
    },
    [clearSettle],
  );

  const handleSaveError = useCallback(
    (error: unknown, retry: () => void) =>
      showToast(formatSaveErrorToast(error, retry)),
    [showToast],
  );

  const mutateLifecycle = useCallback(
    (id: string, action: LifecycleAction) => {
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

  useEffect(() => {
    lifecycleRef.current = mutateLifecycle;
  }, [mutateLifecycle]);

  const toggle = useCallback(
    (task: Task) => mutateLifecycle(task.id, task.done ? "reopen" : "complete"),
    [mutateLifecycle],
  );

  const store = useMemo<TaskStore>(
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
      completedToday: (task) =>
        isTaskCompletedToday(task, clock.timeZone, todayDate),
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
      toggle,
      change,
    ],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
