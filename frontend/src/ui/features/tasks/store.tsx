import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { localTime, today } from "../../../lib/clock";
import { CheckCircleIcon } from "../../components/icons";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import type { TaskApi, TaskRequest } from "../../domain/api";
import type { Project, Task, TimeFormat } from "../../domain/types";

/** Injected clock (IM-05 / ADR-006): no screen reads the system time directly. */
export interface Clock {
  now(): Date;
  timeZone: string;
}

/** A ticked row stays in place this long before it moves to the completed area (TK §2.1). */
export const SETTLE_MS = 600;

export interface TaskStore {
  tasks: Task[];
  projects: Project[];
  today: string;
  timeFormat: TimeFormat;
  clock: Clock;
  api: TaskApi;
  toast: ToastData | null;
  showToast: (toast: Omit<ToastData, "id">) => void;
  dismissToast: (id: ToastData["id"]) => void;
  projectOf: (task: Task) => Project | null;
  /** True for a task ticked less than SETTLE_MS ago: lists keep it in its open section. */
  isSettling: (id: string) => boolean;
  completedToday: (task: Task) => boolean;
  toggle: (task: Task) => void;
  /** Optimistic local change; returns a function that reverts it (UX-01). */
  applyLocal: (update: (tasks: Task[]) => Task[]) => () => void;
  setProjects: (update: (projects: Project[]) => Project[]) => void;
  saveFailed: (retry: () => void) => void;
}

const Ctx = createContext<TaskStore | null>(null);

export function useTaskStore(): TaskStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("useTaskStore needs a <TaskStoreProvider>");
  return store;
}

export interface TaskStoreProviderProps {
  api: TaskApi;
  clock: Clock;
  initialTasks: Task[];
  initialProjects: Project[];
  timeFormat?: TimeFormat;
  children: ReactNode;
}

interface RowDiff {
  addedIds: Set<string>;
  removedTasks: Task[];
  previousTasks: Map<string, Task>;
}

function diffRows(prev: Task[], next: Task[]): RowDiff {
  const prevMap = new Map(prev.map((t) => [t.id, t]));
  const nextMap = new Map(next.map((t) => [t.id, t]));

  const addedIds = new Set<string>();
  const removedTasks: Task[] = [];
  const previousTasks = new Map<string, Task>();

  for (const [id, prevTask] of prevMap) {
    if (!nextMap.has(id)) {
      removedTasks.push(prevTask);
    } else {
      const nextTask = nextMap.get(id)!;
      if (prevTask !== nextTask) {
        previousTasks.set(id, prevTask);
      }
    }
  }

  for (const id of nextMap.keys()) {
    if (!prevMap.has(id)) {
      addedIds.add(id);
    }
  }

  return { addedIds, removedTasks, previousTasks };
}

function undoRows(current: Task[], diff: RowDiff): Task[] {
  const { addedIds, removedTasks, previousTasks } = diff;
  let list = current.filter((t) => !addedIds.has(t.id));
  list = list.map((t) => previousTasks.get(t.id) ?? t);
  if (removedTasks.length > 0) {
    const currentIds = new Set(list.map((t) => t.id));
    for (const task of removedTasks) {
      if (!currentIds.has(task.id)) {
        list.push(task);
      }
    }
  }
  return list;
}

function replace(list: Task[], task: Task): Task[] {
  return list.map((x) => (x.id === task.id ? task : x));
}

export function TaskStoreProvider({
  api,
  clock,
  initialTasks,
  initialProjects,
  timeFormat = "24h",
  children,
}: TaskStoreProviderProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [projects, setProjects] = useState(initialProjects);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [settling, setSettling] = useState<ReadonlySet<string>>(new Set());
  const toastSeq = useRef(0);
  const taskSeq = useRef<Map<string, number>>(new Map());
  const taskQueue = useRef<Map<string, Promise<unknown>>>(new Map());
  const settleTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = settleTimers.current;
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const [, setTick] = useState(0);
  const todayDate = today(clock.timeZone, clock.now());

  // Lists recompute at local midnight while open, and when the tab comes back (LV-E1)
  useEffect(() => {
    const [h, m] = localTime(clock.timeZone, clock.now())
      .split(":")
      .map(Number) as [number, number];
    const msToMidnight =
      ((24 * 60 - (h * 60 + m)) * 60 - clock.now().getSeconds()) * 1000 + 500;
    const timer = setTimeout(() => setTick((n) => n + 1), msToMidnight);
    const onVisible = () =>
      document.visibilityState === "visible" && setTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [clock, todayDate]);

  const showToast = useCallback((data: Omit<ToastData, "id">) => {
    toastSeq.current += 1;
    setToast({ ...data, id: toastSeq.current });
  }, []);
  const dismissToast = useCallback(
    (id: ToastData["id"]) =>
      setToast((current) => (current?.id === id ? null : current)),
    [],
  );

  const applyLocal = useCallback((update: (tasks: Task[]) => Task[]) => {
    let diff: RowDiff | null = null;
    setTasks((prev) => {
      const next = update(prev);
      diff = diffRows(prev, next);
      return next;
    });

    return () => {
      if (!diff) return;
      const d = diff;
      setTasks((current) => undoRows(current, d));
    };
  }, []);

  const saveFailed = useCallback(
    (retry: () => void) =>
      showToast({
        message: t("error.save_failed"),
        actionLabel: t("common.retry"),
        onAction: retry,
      }),
    [showToast],
  );

  const settle = useCallback((id: string) => {
    setSettling((s) => new Set(s).add(id));
    const timer = setTimeout(() => {
      settleTimers.current.delete(timer);
      setSettling((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, SETTLE_MS);
    settleTimers.current.add(timer);
  }, []);

  const send = useCallback(
    (
      taskId: string,
      request: TaskRequest,
      onSaved: (res: { task: Task; next?: Task }) => void,
      onFailed: () => void,
    ) => {
      const seq = (taskSeq.current.get(taskId) ?? 0) + 1;
      taskSeq.current.set(taskId, seq);

      const prev = taskQueue.current.get(taskId) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          try {
            const res = await request();
            if (taskSeq.current.get(taskId) !== seq) return;
            onSaved(res);
          } catch {
            if (taskSeq.current.get(taskId) !== seq) return;
            onFailed();
          }
        })
        .finally(() => {
          if (taskQueue.current.get(taskId) === next) {
            taskQueue.current.delete(taskId);
          }
        });

      taskQueue.current.set(taskId, next);
    },
    [],
  );

  const applySaved = useCallback(
    (res: { task: Task; next?: Task }) =>
      applyLocal((list) =>
        res.next
          ? [...replace(list, res.task), res.next]
          : replace(list, res.task),
      ),
    [applyLocal],
  );

  const reopen = useCallback(
    (task: Task) => {
      const at = clock.now().toISOString();
      const revert = applyLocal((list) =>
        replace(list, { ...task, done: false, done_at: null }),
      );

      send(
        task.id,
        () => api.reopen(task.id, at),
        applySaved,
        () => {
          revert();
          // eslint-disable-next-line react-hooks/immutability -- retry callback invokes itself on failure
          saveFailed(() => reopen(task));
        },
      );
    },
    [clock, applyLocal, send, api, applySaved, saveFailed],
  );

  const complete = useCallback(
    (task: Task) => {
      const at = clock.now().toISOString();
      const revert = applyLocal((list) =>
        replace(list, { ...task, done: true, done_at: at }),
      );
      settle(task.id);
      showToast({
        message: t("task.completed", { title: task.title }),
        icon: <CheckCircleIcon size={18} />,
        actionLabel: t("common.undo"),
        onAction: () => reopen({ ...task, done: true, done_at: at }),
      });

      send(
        task.id,
        () => api.complete(task.id, at),
        applySaved,
        () => {
          revert();
          // eslint-disable-next-line react-hooks/immutability -- retry callback invokes itself on failure
          saveFailed(() => complete(task));
        },
      );
    },
    [
      clock,
      applyLocal,
      settle,
      showToast,
      reopen,
      send,
      api,
      applySaved,
      saveFailed,
    ],
  );

  const toggle = useCallback(
    (task: Task) => (task.done ? reopen(task) : complete(task)),
    [complete, reopen],
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
        !!task.done_at &&
        today(clock.timeZone, new Date(task.done_at)) === todayDate,
      toggle,
      applyLocal,
      setProjects,
      saveFailed,
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
      applyLocal,
      saveFailed,
    ],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
