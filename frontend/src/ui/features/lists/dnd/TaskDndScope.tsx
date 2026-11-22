import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createContext, useContext, useState, type ReactNode } from "react";
import { t } from "../../../copy";

/** A drop into another list of the same screen (#178, cross-section and cross-day). */
export interface CrossDrop {
  id: string;
  from: string;
  to: string;
  /** Where in the target list, as shown. */
  index: number;
}

interface ListEntry {
  ids: () => readonly string[];
  onMove: (id: string, to: number) => void;
}

interface Scope {
  register: (list: string, entry: ListEntry) => () => void;
  list: (list: string) => ListEntry | undefined;
  /** True right after a drag, so the click that ends it doesn't open the row. */
  justDragged: () => boolean;
  markDropped: () => void;
}

function createScope(): Scope {
  const lists = new Map<string, ListEntry>();
  // The click that ends a drag fires before the next tick: held until then
  let dropped = false;
  return {
    register: (list, entry) => {
      lists.set(list, entry);
      return () => lists.delete(list);
    },
    list: (list) => lists.get(list),
    justDragged: () => dropped,
    markDropped: () => {
      dropped = true;
      setTimeout(() => (dropped = false));
    },
  };
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

const ScopeContext = createContext<Scope | null>(null);

export function useDndScope(): Scope | null {
  return useContext(ScopeContext);
}

/**
 * One drag-and-drop area per screen (Spec 02 §3). Mouse: a drag starts after 6 px, so a click
 * still opens the task. Touch: press and hold 250 ms, so the page still scrolls (#178).
 * Keyboard: the row's move handle, Space to pick up, arrows, Space to drop, Escape to cancel.
 */
export function TaskDndScope({
  onCrossDrop,
  children,
}: {
  onCrossDrop?: (drop: CrossDrop) => void;
  children: ReactNode;
}) {
  const [scope] = useState(createScope);
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

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    scope.markDropped();
    if (!over) return;
    const id = String(active.id);
    const from = active.data.current?.sortable?.containerId as string;
    const to =
      (over.data.current?.sortable?.containerId as string | undefined) ??
      String(over.id);
    const target = scope.list(to);
    if (!target) return;
    const shown = target.ids();
    const overIndex = over.data.current?.sortable?.index as number | undefined;
    const index = overIndex ?? shown.length;
    if (from === to) {
      if (String(over.id) !== id) target.onMove(id, index);
      return;
    }
    onCrossDrop?.({ id, from, to, index });
  };

  return (
    <ScopeContext.Provider value={scope}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("dnd.instructions") },
        }}
        onDragEnd={onDragEnd}
        onDragCancel={scope.markDropped}
      >
        {children}
      </DndContext>
    </ScopeContext.Provider>
  );
}
