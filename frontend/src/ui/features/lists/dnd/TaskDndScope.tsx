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
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  /** Whether this list accepts drops from other lists; false for read-only sources like Overdue. */
  acceptsCrossDrop?: boolean;
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
      const aSortable = Boolean(
        a.data?.droppableContainer.data.current?.sortable,
      );
      const bSortable = Boolean(
        b.data?.droppableContainer.data.current?.sortable,
      );
      return (bSortable ? 1 : 0) - (aSortable ? 1 : 0);
    });
  }

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) =>
        c.data.current?.kind !== PROJECT_DROP &&
        c.data.current?.kind !== "section-expand",
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
  const initialContainerRef = useRef<string | null>(null);
  const initialIndexRef = useRef<number | null>(null);
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

  function normalizeContainer(id: string): string {
    return id.replace(/:(bottom|due|empty)$/, "");
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    const task = (active.data.current?.task as Task | undefined) ?? null;
    const fromContainer =
      (active.data.current?.sortable?.containerId as string | undefined) ??
      null;
    initialContainerRef.current = fromContainer;
    const source = fromContainer ? scope.list(fromContainer) : undefined;
    const initialIndex = source
      ? source.ids().indexOf(String(active.id))
      : ((active.data.current?.sortable?.index as number | undefined) ?? null);
    initialIndexRef.current = initialIndex;
    setDragging(titleOf(active));
    setDragState({
      activeId: String(active.id),
      activeTask: task,
      fromContainer,
      overContainer: fromContainer,
      overIndex: initialIndex,
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
    if (
      over.data.current?.kind === PROJECT_DROP ||
      over.data.current?.kind === "section-expand"
    ) {
      setDragState((prev) =>
        prev.overContainer === null
          ? prev
          : { ...prev, overContainer: null, overIndex: null },
      );
      return;
    }
    const rawContainer =
      (over.data.current?.sortable?.containerId as string | undefined) ??
      String(over.id);
    const targetContainer = normalizeContainer(rawContainer);
    const isBottom = String(over.id).endsWith(":bottom");
    const containerEntry = scope.list(targetContainer);
    const fromContainer = initialContainerRef.current;
    if (
      fromContainer !== targetContainer &&
      containerEntry?.acceptsCrossDrop === false
    ) {
      setDragState((prev) =>
        prev.overContainer === null
          ? prev
          : { ...prev, overContainer: null, overIndex: null },
      );
      return;
    }
    const targetIndex = isBottom
      ? (containerEntry?.ids().length ?? 0)
      : ((over.data.current?.sortable?.index as number | undefined) ?? null);
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
    const from =
      initialContainerRef.current ??
      (active.data.current?.sortable?.containerId as string);
    const initialIndex = initialIndexRef.current;
    initialContainerRef.current = null;
    initialIndexRef.current = null;
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
    const source = scope.list(from);
    if (over.data.current?.kind === PROJECT_DROP) {
      source?.onToProject?.(id, over.data.current as ProjectDropData);
      return;
    }
    const rawTo =
      (over.data.current?.sortable?.containerId as string | undefined) ??
      String(over.id);
    const to = normalizeContainer(rawTo);
    const target = scope.list(to);
    if (!target || (from !== to && target.acceptsCrossDrop === false)) return;

    const targetIds = target.ids();
    const targetIndex = targetIds.indexOf(id);

    if (from === to) {
      const isBottom = String(over.id).endsWith(":bottom");
      const overIndex = isBottom
        ? targetIds.length
        : (over.data.current?.sortable?.index as number | undefined);
      if (
        initialIndex !== null &&
        overIndex !== undefined &&
        overIndex !== -1 &&
        overIndex !== initialIndex
      ) {
        target.onMove(id, overIndex);
      }
      return;
    }

    const index = targetIndex !== -1 ? targetIndex : targetIds.length;
    target.onReceive?.({ id, from, index });
  };

  const cancel = () => {
    initialContainerRef.current = null;
    initialIndexRef.current = null;
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
            {(dragState.activeTask || dragging) && (
              <div className="cursor-grabbing rounded-2xl border border-separator/80 bg-surface px-4 py-3 shadow-2xl ring-1 ring-primary/20 max-w-lg min-w-[280px]">
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-separator" />
                  <span className="text-body font-medium text-ink truncate">
                    {dragState.activeTask?.title ?? dragging}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </DragStateContext.Provider>
    </ScopeContext.Provider>
  );
}
