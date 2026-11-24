import { useDndContext, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { GripVerticalIcon } from "../../../components/icons";
import { t } from "../../../copy";
import type { Task } from "../../../domain/types";
import type { RowDrag } from "../../tasks/TaskRow";
import { splitListeners } from "./splitListeners";
import { useDndDragState, useDndScope, type ListEntry } from "./TaskDndScope";

type Handlers = Pick<ListEntry, "onMove" | "onReceive" | "onToProject">;

/**
 * One list whose rows can be dragged (#178). `onMove` gets the index the row was dropped at,
 * `onReceive` a row from another list, `onToProject` one of its rows dropped on a project in
 * the sidebar. Outside a TaskDndScope the rows render as plain rows.
 */
export function SortableTaskList({
  list,
  tasks,
  children,
  ...handlers
}: Handlers & {
  list: string;
  tasks: readonly Task[];
  children: (task: Task, drag?: RowDrag) => ReactNode;
}) {
  const scope = useDndScope();
  const dragState = useDndDragState();

  const isTargetingThis =
    dragState.activeId !== null &&
    dragState.overContainer === list &&
    dragState.fromContainer !== list &&
    dragState.activeTask !== null;

  const isLeavingThis =
    dragState.activeId !== null &&
    dragState.fromContainer === list &&
    dragState.overContainer !== null &&
    dragState.overContainer !== list;

  const displayTasks = useMemo(() => {
    if (isLeavingThis) {
      return tasks.filter((t) => t.id !== dragState.activeId);
    }
    if (isTargetingThis && dragState.activeTask) {
      if (tasks.some((t) => t.id === dragState.activeTask!.id)) {
        return tasks;
      }
      const idx =
        dragState.overIndex !== null &&
        dragState.overIndex >= 0 &&
        dragState.overIndex <= tasks.length
          ? dragState.overIndex
          : tasks.length;
      const next = [...tasks];
      next.splice(idx, 0, dragState.activeTask);
      return next;
    }
    return tasks;
  }, [
    tasks,
    isLeavingThis,
    isTargetingThis,
    dragState.activeId,
    dragState.activeTask,
    dragState.overIndex,
  ]);

  const ids = useMemo(
    () => displayTasks.map((task) => task.id),
    [displayTasks],
  );

  const latest = useRef({ ids, handlers });
  useEffect(() => {
    latest.current = { ids, handlers };
  });
  useEffect(
    () =>
      scope?.register(list, {
        ids: () => latest.current.ids,
        onMove: (id, to) => latest.current.handlers.onMove(id, to),
        onReceive: (drop) => latest.current.handlers.onReceive?.(drop),
        onToProject: (id, project) =>
          latest.current.handlers.onToProject?.(id, project),
      }),
    [scope, list],
  );
  const { setNodeRef, isOver } = useDroppable({ id: list, disabled: !scope });
  const { active } = useDndContext();

  if (!scope) return <>{tasks.map((task) => children(task))}</>;
  return (
    <SortableContext
      id={list}
      items={ids}
      strategy={verticalListSortingStrategy}
    >
      {/* An empty list still takes drops: shows clean drop zone only when dragged over */}
      {displayTasks.length === 0 && (
        <li
          ref={setNodeRef}
          aria-hidden="true"
          className={
            isOver
              ? "m-1 min-h-12 rounded-tile border border-dashed border-primary bg-primary/10 transition-all duration-200 list-none"
              : active
                ? "min-h-10 w-full list-none"
                : "h-0"
          }
        />
      )}
      {displayTasks.map((task) => (
        <SortableRow key={task.id} task={task}>
          {(drag) =>
            children(task, {
              ...drag,
              dragging:
                drag?.dragging ||
                (isTargetingThis && task.id === dragState.activeId),
            })
          }
        </SortableRow>
      ))}
    </SortableContext>
  );
}

function SortableRow({
  task,
  children,
}: {
  task: Task;
  children: (drag: RowDrag) => ReactNode;
}) {
  const scope = useDndScope();
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    attributes,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { title: task.title, task },
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });
  // Mouse and touch pick up the whole row; the keyboard uses the handle
  const { pointer, keyboard } = splitListeners(listeners);

  return children({
    setNodeRef,
    dragging: isDragging,
    style: {
      transform: isDragging ? undefined : CSS.Translate.toString(transform),
      transition: isDragging ? undefined : transition,
    },
    rowListeners: {
      ...pointer,
      onClickCapture: (e) => {
        if (!scope?.justDragged()) return;
        e.preventDefault();
        e.stopPropagation();
      },
    },
    handle: (
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        onKeyDown={keyboard}
        aria-label={t("list.move_task", { title: task.title })}
        className="focus-ring absolute left-0 top-1/2 inline-flex h-8 w-4 -translate-y-1/2 cursor-grab items-center justify-center border-0 bg-transparent p-0 text-ink-tertiary opacity-0 transition-opacity group-hover/task:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        <GripVerticalIcon size={14} />
      </button>
    ),
  });
}
