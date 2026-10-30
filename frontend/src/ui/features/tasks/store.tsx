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
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

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
    const before = tasksRef.current;
    const after = update(before);
    tasksRef.current = after;
    setTasks(after);
    return () => {
      tasksRef.current = before;
      setTasks(before);
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
      const revert = applyLocal((list) =>
        replace(list, { ...task, done: false, done_at: null }),
      );
      api.reopen(task.id, at).then(
        ({ task: saved, removedNextId }) =>
          applyLocal((list) =>
            replace(list, saved).filter((x) => x.id !== removedNextId),
          ),
        () => {
          revert();
          saveFailed(() => reopen(task));
        },
      );
    },
    [api, clock, applyLocal, saveFailed],
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
      api.complete(task.id, at).then(
        ({ task: saved, next }) =>
          applyLocal((list) =>
            next ? [...replace(list, saved), next] : replace(list, saved),
          ),
        () => {
          revert();
          saveFailed(() => complete(task));
        },
      );
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
