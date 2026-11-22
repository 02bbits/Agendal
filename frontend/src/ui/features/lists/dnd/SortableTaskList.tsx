import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, type ReactNode } from "react";
import { GripVerticalIcon } from "../../../components/icons";
import { t } from "../../../copy";
import type { Task } from "../../../domain/types";
import type { RowDrag } from "../../tasks/TaskRow";
import { splitListeners } from "./splitListeners";
import { useDndScope } from "./TaskDndScope";

/**
 * One list whose rows can be dragged (#178). `onMove` gets the index the row was dropped at;
 * outside a TaskDndScope the rows render as plain rows.
 */
export function SortableTaskList({
  list,
  tasks,
  onMove,
  children,
}: {
  list: string;
  tasks: readonly Task[];
  onMove: (id: string, to: number) => void;
  children: (task: Task, drag?: RowDrag) => ReactNode;
}) {
  const scope = useDndScope();
  const ids = tasks.map((task) => task.id);
  const latest = useRef({ ids, onMove });
  useEffect(() => {
    latest.current = { ids, onMove };
  });
  useEffect(
    () =>
      scope?.register(list, {
        ids: () => latest.current.ids,
        onMove: (id, to) => latest.current.onMove(id, to),
      }),
    [scope, list],
  );
  const { setNodeRef } = useDroppable({ id: list, disabled: !scope });

  if (!scope) return <>{tasks.map((task) => children(task))}</>;
  return (
    <SortableContext
      id={list}
      items={ids}
      strategy={verticalListSortingStrategy}
    >
      {/* An empty list still takes drops */}
      {tasks.length === 0 && <li ref={setNodeRef} className="min-h-11" />}
      {tasks.map((task) => (
        <SortableRow key={task.id} task={task}>
          {(drag) => children(task, drag)}
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
  } = useSortable({ id: task.id, data: { title: task.title } });
  // Mouse and touch pick up the whole row; the keyboard uses the handle
  const { pointer, keyboard } = splitListeners(listeners);

  return children({
    setNodeRef,
    dragging: isDragging,
    style: {
      transform: CSS.Translate.toString(transform),
      transition,
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
