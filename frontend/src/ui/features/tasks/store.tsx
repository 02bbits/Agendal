/* eslint-disable react-hooks/immutability, react-hooks/refs -- a failed save retries the same action, and tasksRef mirrors state so a revert snapshot is synchronous */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { today } from "../../../lib/clock";
import { CheckCircleIcon } from "../../components/icons";
import type { ToastData } from "../../components/Toast";
import { t } from "../../copy";
import type { TaskApi } from "../../domain/api";
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

  const todayDate = today(clock.timeZone, clock.now());

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
    let diff: {
      addedIds: Set<string>;
      removedTasks: Task[];
      previousTasks: Map<string, Task>;
    } | null = null;

    setTasks((prev) => {
      const next = update(prev);
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

      diff = { addedIds, removedTasks, previousTasks };
      return next;
    });

    return () => {
      if (!diff) return;
      const { addedIds, removedTasks, previousTasks } = diff;
      setTasks((current) => {
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
      });
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
    setTimeout(() => {
      setSettling((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, SETTLE_MS);
  }, []);

  const replace = (list: Task[], task: Task) =>
    list.map((x) => (x.id === task.id ? task : x));

  const reopen = useCallback(
    (task: Task) => {
      const at = clock.now().toISOString();
      const seq = (taskSeq.current.get(task.id) ?? 0) + 1;
      taskSeq.current.set(task.id, seq);

      const revert = applyLocal((list) =>
        replace(list, { ...task, done: false, done_at: null }),
      );

      const prev = taskQueue.current.get(task.id) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          try {
            const res = await api.reopen(task.id, at);
            if (taskSeq.current.get(task.id) !== seq) return;
            applyLocal((list) =>
              replace(list, res.task).filter((x) => x.id !== res.removedNextId),
            );
          } catch {
            if (taskSeq.current.get(task.id) !== seq) return;
            revert();
            saveFailed(() => reopen(task));
          }
        })
        .finally(() => {
          if (taskQueue.current.get(task.id) === next) {
            taskQueue.current.delete(task.id);
          }
        });

      taskQueue.current.set(task.id, next);
    },
    [api, clock, applyLocal, saveFailed],
  );

  const complete = useCallback(
    (task: Task) => {
      const at = clock.now().toISOString();
      const seq = (taskSeq.current.get(task.id) ?? 0) + 1;
      taskSeq.current.set(task.id, seq);

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

      const prev = taskQueue.current.get(task.id) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          try {
            const res = await api.complete(task.id, at);
            if (taskSeq.current.get(task.id) !== seq) return;
            applyLocal((list) =>
              res.next
                ? [...replace(list, res.task), res.next]
                : replace(list, res.task),
            );
          } catch {
            if (taskSeq.current.get(task.id) !== seq) return;
            revert();
            saveFailed(() => complete(task));
          }
        })
        .finally(() => {
          if (taskQueue.current.get(task.id) === next) {
            taskQueue.current.delete(task.id);
          }
        });

      taskQueue.current.set(task.id, next);
    },
    [api, clock, applyLocal, settle, showToast, reopen, saveFailed],
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
