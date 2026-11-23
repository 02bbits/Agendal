import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createContext, useContext, useState, type ReactNode } from "react";
import { t } from "../../../copy";
import type { Task } from "../../../domain/types";
import { PROJECT_DROP, type ProjectDropData } from "./dropTargets";

/** A drop into another list of the screen (#178): Inbox sections, Upcoming days. */
export interface Receive {
  id: string;
  /** The list the task came from. */
  from: string;
  /** Where in this list, as shown. */
  index: number;
}

export interface ListEntry {
  ids: () => readonly string[];
  onMove: (id: string, to: number) => void;
  /** What a drop from another list means here; without it the list takes no drops. */
  onReceive?: (drop: Receive) => void;
  /** A row of this list dropped on a project in the sidebar. */
  onToProject?: (id: string, project: ProjectDropData) => void;
}

interface Scope {
  register: (list: string, entry: ListEntry) => () => void;
  /** True right after a drag, so the click that ends it doesn't open the row. */
  justDragged: () => boolean;
}

function createScope() {
  const lists = new Map<string, ListEntry>();
  // The click that ends a drag fires before the next tick: held until then
  let dropped = false;
  return {
    register: (list: string, entry: ListEntry) => {
      lists.set(list, entry);
      return () => {
        if (lists.get(list) === entry) lists.delete(list);
      };
    },
    list: (list: string) => lists.get(list),
    justDragged: () => dropped,
    markDropped: () => {
      dropped = true;
      setTimeout(() => (dropped = false));
    },
  };
}

export interface DndDragState {
  activeId: string | null;
  activeTask: Task | null;
  fromContainer: string | null;
  overContainer: string | null;
  overIndex: number | null;
}

const ScopeContext = createContext<Scope | null>(null);
const DragStateContext = createContext<DndDragState>({
  activeId: null,
  activeTask: null,
  fromContainer: null,
  overContainer: null,
  overIndex: null,
});

export function useDndScope(): Scope | null {
  return useContext(ScopeContext);
}

export function useDndDragState(): DndDragState {
  return useContext(DragStateContext);
}

type Item = { data: { current?: Record<string, unknown> } } | null;
const titleOf = (item: Item) => String(item?.data.current?.title ?? "");

/** What screen readers hear while a task moves: its title, never an id (A11Y). */
const announcements: Announcements = {
  onDragStart: ({ active }) => t("dnd.picked", { title: titleOf(active) }),
  onDragOver: ({ active, over }) =>
    over && over.id !== active.id && titleOf(over)
      ? t("dnd.over", { title: titleOf(active), target: titleOf(over) })
      : undefined,
  onDragEnd: ({ active }) => t("dnd.dropped", { title: titleOf(active) }),
  onDragCancel: ({ active }) => t("dnd.cancelled", { title: titleOf(active) }),
};

/**
 * A sidebar project is hit only under the pointer.
 * For items and containers, pointerWithin is checked first (with sortable items taking
 * precedence over the container droppable) to prevent oscillation jitter.
 */
const collision: CollisionDetection = (args) => {
  const projects = pointerWithin(args).filter(
    (c) => c.data?.droppableContainer.data.current?.kind === PROJECT_DROP,
  );
  if (projects.length) return projects;

  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions.slice().sort((a, b) => {
      const aSortable = Boolean(a.data?.droppableContainer.data.current?.sortable);
      const bSortable = Boolean(b.data?.droppableContainer.data.current?.sortable);
      return (bSortable ? 1 : 0) - (aSortable ? 1 : 0);
    });
  }

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.data.current?.kind !== PROJECT_DROP,
    ),
  });
};

/**
 * The drag-and-drop area (Spec 02 §3). One for the app, around the sidebar too; one opened
 * inside another adds nothing. Mouse: a drag starts after 6 px, so a click still opens the
 * task. Touch: press and hold 250 ms, so the page still scrolls (#178). Keyboard: the row's
 * move handle, Space to pick up, arrows, Space to drop, Escape to cancel.
 */
export function TaskDndScope({ children }: { children: ReactNode }) {
  const parent = useDndScope();
  if (parent) return <>{children}</>;
  return <RootScope>{children}</RootScope>;
}

function RootScope({ children }: { children: ReactNode }) {
  const [scope] = useState(createScope);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DndDragState>({
    activeId: null,
    activeTask: null,
    fromContainer: null,
    overContainer: null,
    overIndex: null,
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Each arrow press lands at once; a smooth scroll made the row lag behind the key
      scrollBehavior: "auto",
    }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const task = (active.data.current?.task as Task | undefined) ?? null;
    const fromContainer =
      (active.data.current?.sortable?.containerId as string | undefined) ?? null;
    setDragging(titleOf(active));
    setDragState({
      activeId: String(active.id),
      activeTask: task,
      fromContainer,
      overContainer: fromContainer,
      overIndex:
        (active.data.current?.sortable?.index as number | undefined) ?? null,
    });
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) {
      setDragState((prev) =>
        prev.overContainer === null
          ? prev
          : { ...prev, overContainer: null, overIndex: null },
      );
      return;
    }
    if (over.data.current?.kind === PROJECT_DROP) {
      setDragState((prev) => ({
        ...prev,
        overContainer: null,
        overIndex: null,
      }));
      return;
    }
    const targetContainer =
      (over.data.current?.sortable?.containerId as string | undefined) ??
      String(over.id);
    const targetIndex =
      (over.data.current?.sortable?.index as number | undefined) ?? null;
    setDragState((prev) => {
      if (
        prev.overContainer === targetContainer &&
        prev.overIndex === targetIndex
      ) {
        return prev;
      }
      return {
        ...prev,
        overContainer: targetContainer,
        overIndex: targetIndex,
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    scope.markDropped();
    setDragging(null);
    setDragState({
      activeId: null,
      activeTask: null,
      fromContainer: null,
      overContainer: null,
      overIndex: null,
    });
    if (!over) return;
    const id = String(active.id);
    const from = active.data.current?.sortable?.containerId as string;
    const source = scope.list(from);
    if (over.data.current?.kind === PROJECT_DROP) {
      source?.onToProject?.(id, over.data.current as ProjectDropData);
      return;
    }
    const to =
      (over.data.current?.sortable?.containerId as string | undefined) ??
      String(over.id);
    const target = scope.list(to);
    if (!target) return;
    const overIndex = over.data.current?.sortable?.index as number | undefined;
    const index = overIndex ?? target.ids().length;
    if (from === to) {
      if (String(over.id) !== id) target.onMove(id, index);
      return;
    }
    target.onReceive?.({ id, from, index });
  };

  const cancel = () => {
    scope.markDropped();
    setDragging(null);
    setDragState({
      activeId: null,
      activeTask: null,
      fromContainer: null,
      overContainer: null,
      overIndex: null,
    });
  };

  return (
    <ScopeContext.Provider value={scope}>
      <DragStateContext.Provider value={dragState}>
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t("dnd.instructions") },
          }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={cancel}
        >
          {children}
          {/* Rows sit in clipped cards: the moving card floats above everything instead */}
          <DragOverlay dropAnimation={null}>
            {dragging !== null && (
              <div className="cursor-grabbing rounded-tile border border-separator bg-surface px-4 py-3 text-body font-medium text-ink shadow-lg">
                {dragging}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </DragStateContext.Provider>
    </ScopeContext.Provider>
  );
}
