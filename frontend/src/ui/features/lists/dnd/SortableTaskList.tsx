import { useDndContext, useDroppable } from "@dnd-kit/core";
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
import { useDndScope, type ListEntry } from "./TaskDndScope";

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
  const ids = tasks.map((task) => task.id);
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
      {/* An empty list still takes drops: a line shows where while a task is dragged */}
      {tasks.length === 0 && (
        <li
          ref={setNodeRef}
          aria-hidden="true"
          className={
            active
              ? `m-1 min-h-11 rounded-tile border border-dashed ${isOver ? "border-primary bg-primary/10" : "border-separator"}`
              : "h-0"
          }
        />
      )}
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
