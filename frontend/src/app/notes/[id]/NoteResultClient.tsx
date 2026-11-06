"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { appClock } from "../../appClock";
import { useAppFrame } from "../../AppFrame";
import { PageMessage } from "../../PageMessage";
import { ApiRequestError } from "../../../lib/apiError";
import {
  confirmNote,
  deleteNote,
  getNote,
  makeFollowupTask,
  previewTaskApi,
  recallNote,
  redoNote,
  renameNote,
  undoNote,
} from "../../../lib/noteApi";
import { useOffline } from "../../../lib/online";
import { getTask, httpTaskApi, projects } from "../../../lib/taskApi";
import {
  NoteResultScreen,
  TaskPanel,
  TaskStoreProvider,
  t,
  tc,
  useTaskStore,
  type NoteResult,
  type Project,
  type Task,
} from "../../../ui";
import { nameOf } from "../../../ui/features/notes/NoteResultScreen";
import { ROUTES, type Navigate } from "../../../ui/features/shell/routes";
import { useMediaQuery } from "../../../ui/components/useMediaQuery";
import { NoteTaskEditor } from "../../../ui/features/notes/NoteTaskEditor";
import { useHistoryEntry } from "../../../ui/components/useHistoryEntry";
import { TaskDetails } from "../../../ui/features/tasks/details/TaskDetails";
import { DeleteTask } from "../../../ui/features/tasks/DeleteTask";
import { DiscardDialog } from "../../../ui/features/tasks/new/DiscardDialog";

export const SKELETON_DELAY_MS = 300;

interface ClientProps {
  id: string;
  presentation?: "screen" | "panel";
  onClose?: () => void;
  /** Set while the note is shown: `false` means it asked first and stays open */
  closeGuardRef?: RefObject<(() => boolean) | null>;
}

interface Loaded {
  result: NoteResult;
  /** Tasks the note touched that still exist, as they are now */
  tasks: Task[];
  /** Ids of tasks removed since (RV-E13) */
  gone: ReadonlySet<string>;
  /** For Task details on Check this first */
  projects: Project[];
}

const touched = (result: NoteResult) =>
  result.changes.filter((change) => change.kind !== "deleted");

function OpenedTask({
  id,
  wide,
  onClose,
  weekStart,
}: {
  id: string;
  wide: boolean;
  onClose: () => void;
  weekStart: "mon" | "sun";
}) {
  const store = useTaskStore();
  const task = store.tasks.find((task) => task.id === id);
  if (wide)
    return (
      <TaskPanel
        modal
        taskId={id}
        onClose={onClose}
        projects={store.projects}
        weekStart={weekStart}
      />
    );
  return (
    task && (
      <div
        className="fixed inset-0 z-[60] overflow-y-auto bg-paper md:left-[248px]"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <TaskDetails
          task={task}
          variant="screen"
          onBack={onClose}
          weekStart={weekStart}
          autoFocusTitle
          deleteAction={<DeleteTask task={task} onDeleted={onClose} />}
        />
      </div>
    )
  );
}

/**
 * A result just made in this session is already here, so the note isn't asked for again. Each
 * task is always checked, so a row opened and deleted since shows "Removed since" (RV-E13).
 */
async function load(id: string): Promise<Loaded> {
  const result = recallNote(id) ?? (await getNote(id));
  // A `confirm` note's rows are a preview: none of their tasks exist yet, and Task details edits them
  if (result.note.status === "confirm")
    return {
      result,
      tasks: touched(result).map((change) => change.task),
      gone: new Set(),
      projects: (await projects().catch(() => null)) ?? [],
    };
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
  return {
    result,
    tasks,
    gone,
    projects: (await projects().catch(() => null)) ?? [],
  };
}

function ResultContainer({
  result: initial,
  gone,
  back,
  navigate,
  weekStart,
  showToast,
  editFollowupNote,
  edits,
  projectList,
  presentation,
  closeGuardRef,
}: {
  result: NoteResult;
  gone: ReadonlySet<string>;
  back: () => void;
  navigate?: Navigate;
  weekStart: "mon" | "sun";
  showToast: ReturnType<typeof useAppFrame>["showToast"];
  editFollowupNote: ReturnType<typeof useAppFrame>["editFollowupNote"];
  edits?: Parameters<typeof confirmNote>[2];
  projectList: Project[];
  presentation: "screen" | "panel";
  closeGuardRef?: ClientProps["closeGuardRef"];
}): ReactElement {
  const store = useTaskStore();
  const offline = useOffline();
  const [result, setResult] = useState(initial);
  const [conflicts, setConflicts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  // Check this first hasn't applied anything yet: leaving asks first, and the note stays pending
  const reviewing = result.note.status === "confirm";
  const [askDiscard, setAskDiscard] = useState(false);
  const leave = () => (reviewing ? setAskDiscard(true) : back());
  useEffect(() => {
    if (!closeGuardRef) return;
    closeGuardRef.current = () => {
      if (reviewing) setAskDiscard(true);
      return !reviewing;
    };
    return () => {
      closeGuardRef.current = null;
    };
  }, [closeGuardRef, reviewing]);
  const wide = useMediaQuery("(min-width: 1280px)");
  const [openedTask, setOpenedTask] = useState<Task | null>(null);
  const closeTask = () => {
    setOpenedTask(null);
    window.dispatchEvent(new CustomEvent("agendal:note-updated"));
  };
  useHistoryEntry(!!openedTask, closeTask);
  const openTask = (task: Task) => {
    if (result.note.status === "confirm") setOpenId(task.id);
    else if (wide) setOpenedTask(task);
    else navigate?.(ROUTES.task(task.id));
  };
  // The note's tasks changed under the lists: Inbox, Upcoming and the sidebar load them again
  const listsChanged = () =>
    window.dispatchEvent(new CustomEvent("agendal:task-created"));
  // The toast's Undo redoes the note while the server still allows it (RV-2, RV-E6)
  const redo = async () => {
    const outcome = await redoNote(result.note.id);
    if ("result" in outcome) {
      setResult(outcome.result);
      listsChanged();
    } else if ("error" in outcome) showToast(t(outcome.error));
  };
  const undo = async (confirmConflicts: boolean) => {
    const outcome = await undoNote(result.note.id, confirmConflicts);
    setConflicts("conflicts" in outcome ? outcome.conflicts : 0);
    if ("error" in outcome) return showToast(t(outcome.error));
    if (!("result" in outcome)) return;
    setResult(outcome.result);
    listsChanged();
    showToast({
      message: t("note.undone"),
      actionLabel: t("common.undo"),
      onAction: redo,
    });
  };
  // Check this first (NU-5): Apply goes back to where the note was written. Its toast offers Undo,
  // which undoes the whole note from there (RV-2). Tasks edited by hand since ask first, on the
  // note's screen: ponytail: the toast opens it rather than asking from the list
  const apply = async () => {
    setBusy(true);
    const outcome = await confirmNote(result.note.id, "apply", edits, excluded);
    setBusy(false);
    if ("error" in outcome)
      return showToast(t(outcome.error, { request_id: "" }));
    const id = outcome.note.id;
    listsChanged();
    showToast({
      message: tc("note.made", outcome.changes.length),
      actionLabel: t("common.undo"),
      onAction: async () => {
        const undone = await undoNote(id, false);
        if ("conflicts" in undone) return navigate?.(ROUTES.note(id));
        if ("error" in undone) return showToast(t(undone.error));
        listsChanged();
        showToast({
          message: t("note.undone"),
          actionLabel: t("common.undo"),
          onAction: async () => {
            const redone = await redoNote(id);
            if ("error" in redone) showToast(t(redone.error));
            else listsChanged();
          },
        });
      },
    });
    back();
  };
  // Edit note (RV-5): opens the note's text in the editor; Make tasks replans it.
  const edit = () => {
    editFollowupNote(result.note);
  };
  // Keep it as task plans the note's text as one task: the note reloads as Check this first, and
  // nothing is made until Apply (RV-3)
  const remove = async () => {
    setBusy(true);
    let outcome: Awaited<ReturnType<typeof deleteNote>>;
    try {
      outcome = await deleteNote(result.note.id);
    } finally {
      setBusy(false);
    }
    if (outcome !== true)
      return showToast(t(outcome.error, { request_id: "" }));
    window.dispatchEvent(new CustomEvent("agendal:note-updated"));
    showToast(t("note.deleted", { name: nameOf(result) }));
    back();
  };

  const makeTask = async () => {
    setBusy(true);
    const outcome = await makeFollowupTask(result.note.id);
    setBusy(false);
    if ("error" in outcome)
      return showToast(t(outcome.error, { request_id: "" }));
    window.dispatchEvent(new CustomEvent("agendal:note-updated"));
  };
  const live = useMemo(
    () => ({
      ...Object.fromEntries(store.tasks.map((task) => [task.id, task])),
      ...Object.fromEntries([...gone].map((id) => [id, null])),
    }),
    [store.tasks, gone],
  );
  return (
    <>
      <div inert={!!openId || !!openedTask}>
        <NoteResultScreen
          result={{
            ...result,
            changes: result.changes.filter(
              (change) => !change.ref || !excluded.includes(change.ref),
            ),
          }}
          presentation={presentation}
          projects={projectList}
          omittedCount={excluded.length}
          onRestoreOmission={() => setExcluded((values) => values.slice(0, -1))}
          live={live}
          today={store.today}
          timeZone={store.clock.timeZone}
          timeFormat={store.timeFormat}
          weekStart={weekStart}
          onDone={leave}
          onApply={apply}
          onEdit={edit}
          onMakeTask={makeTask}
          onDelete={remove}
          onRename={async (name) => {
            const outcome = await renameNote(result.note.id, name);
            if ("error" in outcome) {
              showToast(t(outcome.error, { request_id: "" }));
              return false;
            }
            // Only the name changed: keep this screen (and any planned edits), refresh the list
            setResult((current) => ({ ...current, note: outcome.note }));
            window.dispatchEvent(new CustomEvent("agendal:note-renamed"));
            return true;
          }}
          busy={busy}
          onUndo={undo}
          conflicts={conflicts}
          onCancelUndo={() => setConflicts(0)}
          offline={offline}
          onSetDue={(task, date) => store.update(task, { due_date: date })}
          onOpenTask={openTask}
          navigate={navigate}
        />
      </div>
      {openId && result.note.status === "confirm" && (
        <NoteTaskEditor
          key={openId}
          creating={
            result.changes.find((change) => change.task.id === openId)?.kind ===
            "created"
          }
          task={store.tasks.find((task) => task.id === openId)!}
          weekStart={weekStart}
          onCancel={() => setOpenId(null)}
          onDone={(patch) => {
            store.update(openId, patch);
            setOpenId(null);
          }}
          onOmit={() => {
            const ref = result.changes.find(
              (change) => change.task.id === openId,
            )?.ref;
            if (ref) setExcluded((values) => [...values, ref]);
            setOpenId(null);
          }}
        />
      )}
      {openedTask && (
        <TaskStoreProvider
          api={httpTaskApi}
          clock={store.clock}
          initialTasks={[openedTask]}
          initialProjects={projectList}
          timeFormat={store.timeFormat}
        >
          <OpenedTask
            id={openedTask.id}
            wide={wide}
            onClose={closeTask}
            weekStart={weekStart}
          />
        </TaskStoreProvider>
      )}
      <DiscardDialog
        open={askDiscard}
        title={t("note.discard_review_title")}
        description={t("note.discard_review_body")}
        onDiscard={() => {
          setAskDiscard(false);
          back();
        }}
        onKeepEditing={() => setAskDiscard(false)}
      />
    </>
  );
}

/** `/notes/{id}`: what a note did (RV-1), or will do once applied (NU-5). */
export default function NoteResultClient({
  id,
  presentation = "screen",
  onClose,
  closeGuardRef,
}: ClientProps): ReactElement | null {
  const { back, navigate, settings, showToast, editFollowupNote } =
    useAppFrame();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [errorState, setErrorState] = useState<{
    notFound: boolean;
    message?: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const changed = () => {
      setLoaded(null);
      setErrorState(null);
      setReloadKey((key) => key + 1);
    };
    window.addEventListener("agendal:note-updated", changed);
    return () => window.removeEventListener("agendal:note-updated", changed);
  }, []);

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

  // Check this first edits the planned tasks in memory until Apply (NU-5)
  const preview = useMemo(
    () =>
      loaded?.result.note.status === "confirm"
        ? previewTaskApi(loaded.result)
        : null,
    [loaded],
  );

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
      api={preview?.api ?? httpTaskApi}
      clock={appClock}
      initialTasks={loaded.tasks}
      initialProjects={loaded.projects}
      timeFormat={settings.timeFormat}
    >
      <ResultContainer
        result={loaded.result}
        gone={loaded.gone}
        back={onClose ?? back}
        navigate={navigate}
        weekStart={settings.weekStart}
        showToast={showToast}
        editFollowupNote={editFollowupNote}
        edits={preview?.edits}
        projectList={loaded.projects}
        presentation={presentation}
        closeGuardRef={closeGuardRef}
      />
    </TaskStoreProvider>
  );
}
