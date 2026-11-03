"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { appClock } from "../../appClock";
import { useAppFrame } from "../../AppFrame";
import { PageMessage } from "../../PageMessage";
import { ApiRequestError } from "../../../lib/apiError";
import { clarifyNote, getNote, recallNote } from "../../../lib/noteApi";
import { getTask, httpTaskApi } from "../../../lib/taskApi";
import {
  NoteResultScreen,
  TaskStoreProvider,
  t,
  useTaskStore,
  type NoteResult,
  type Task,
} from "../../../ui";
import type { Navigate } from "../../../ui/features/shell/routes";

export const SKELETON_DELAY_MS = 300;

interface ClientProps {
  id: string;
}

interface Loaded {
  result: NoteResult;
  /** Tasks the note touched that still exist, as they are now */
  tasks: Task[];
  /** Ids of tasks removed since (RV-E13) */
  gone: ReadonlySet<string>;
}

const touched = (result: NoteResult) =>
  result.changes.filter((change) => change.kind !== "deleted");

/**
 * A result just made in this session is already here, so the note isn't asked for again. Each
 * task is always checked, so a row opened and deleted since shows "Removed since" (RV-E13).
 */
async function load(id: string): Promise<Loaded> {
  const result = recallNote(id) ?? (await getNote(id));
  const tasks: Task[] = [];
  const gone = new Set<string>();
  await Promise.all(
    touched(result).map(async (change) => {
      try {
        tasks.push(await getTask(change.task.id));
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404)
          gone.add(change.task.id);
        // Any other failure: show the task as the note left it
        else tasks.push(change.task);
      }
    }),
  );
  return { result, tasks, gone };
}

function ResultContainer({
  result,
  gone,
  back,
  navigate,
  weekStart,
  onClarify,
}: {
  result: NoteResult;
  gone: ReadonlySet<string>;
  back: () => void;
  navigate?: Navigate;
  weekStart: "mon" | "sun";
  onClarify: (text: string) => Promise<void>;
}): ReactElement {
  const store = useTaskStore();
  const live = useMemo(
    () => ({
      ...Object.fromEntries(store.tasks.map((task) => [task.id, task])),
      ...Object.fromEntries([...gone].map((id) => [id, null])),
    }),
    [store.tasks, gone],
  );
  return (
    <NoteResultScreen
      result={result}
      live={live}
      today={store.today}
      timeZone={store.clock.timeZone}
      timeFormat={store.timeFormat}
      weekStart={weekStart}
      onDone={back}
      onSetDue={(task, date) => store.update(task, { due_date: date })}
      onClarify={onClarify}
      navigate={navigate}
    />
  );
}

/** `/notes/{id}`: what a note did (RV-1). */
export default function NoteResultClient({
  id,
}: ClientProps): ReactElement | null {
  const { back, navigate, settings } = useAppFrame();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [errorState, setErrorState] = useState<{
    notFound: boolean;
    message?: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load(id)
      .then((next) => {
        if (!cancelled) setLoaded(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 404)
          setErrorState({ notFound: true });
        else if (error instanceof ApiRequestError)
          setErrorState({
            notFound: false,
            message: t("error.generic", {
              request_id: error.requestId ?? error.code,
            }),
          });
        else setErrorState({ notFound: false, message: t("app.offline") });
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const loading = !loaded && !errorState;
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const retry = () => {
    setShowSkeleton(false);
    setErrorState(null);
    setReloadKey((key) => key + 1);
  };

  if (errorState?.notFound)
    return (
      <PageMessage
        message={t("error.not_found")}
        actionLabel={t("common.back")}
        onAction={back}
      />
    );
  if (errorState)
    return (
      <PageMessage
        message={errorState.message ?? t("app.offline")}
        actionLabel={t("common.retry")}
        onAction={retry}
      />
    );
  if (!loaded) {
    if (!showSkeleton) return null;
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex animate-pulse flex-col gap-6 pb-8"
      >
        <div className="h-10 w-24 rounded bg-surface" />
        <div className="h-14 w-full rounded bg-surface" />
        <div className="h-32 w-full rounded bg-surface" />
        <div className="h-32 w-full rounded bg-surface" />
      </div>
    );
  }

  return (
    <TaskStoreProvider
      key={`${loaded.result.note.id}:${loaded.result.note.status}:${loaded.result.note.processed_at}`}
      api={httpTaskApi}
      clock={appClock}
      initialTasks={loaded.tasks}
      initialProjects={[]}
      timeFormat={settings.timeFormat}
    >
      <ResultContainer
        result={loaded.result}
        gone={loaded.gone}
        back={back}
        navigate={navigate}
        weekStart={settings.weekStart}
        onClarify={async (text) => {
          const result = await clarifyNote(loaded.result.note, text);
          setLoaded({
            result,
            tasks: touched(result).map((change) => change.task),
            gone: new Set(),
          });
        }}
      />
    </TaskStoreProvider>
  );
}
