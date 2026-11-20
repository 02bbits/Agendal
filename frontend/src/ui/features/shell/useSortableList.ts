import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { prefersReducedMotion } from "../../domain/motion";
import {
  clearMotion,
  moveItem,
  releasePointer,
  settleDropped,
  slideMovedRows,
  targetIndexFor,
} from "./sortableRows";

export interface SortableItemProps {
  ref: (el: HTMLElement | null) => void;
  className?: string;
  style?: CSSProperties;
  "data-sortable-id": string;
}

export interface SortableHandleProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove?: (e: ReactPointerEvent) => void;
  onPointerUp?: (e: ReactPointerEvent) => void;
  onPointerCancel?: (e: ReactPointerEvent) => void;
  className: string;
  "aria-hidden": boolean;
}

export function useSortableList<T extends string>(
  order: T[],
  onCommit: (next: T[]) => void,
) {
  const [displayOrder, setDisplayOrder] = useState<T[]>(order);
  const [draggingId, setDraggingId] = useState<T | null>(null);

  const draggingIdRef = useRef<T | null>(draggingId);
  const displayOrderRef = useRef<T[]>(displayOrder);
  const onCommitRef = useRef(onCommit);

  useLayoutEffect(() => {
    draggingIdRef.current = draggingId;
    displayOrderRef.current = displayOrder;
    onCommitRef.current = onCommit;
  });

  const itemElementsRef = useRef<Map<T, HTMLElement>>(new Map());
  const itemRectsRef = useRef<Map<T, DOMRect>>(new Map());
  const prevTopsRef = useRef<Map<T, number>>(new Map());
  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const startOrderRef = useRef<T[]>(order);
  const activePointerIdRef = useRef<number | null>(null);
  const handleElementRef = useRef<HTMLElement | null>(null);

  // Sync external order changes when not dragging. Keyed by content: a caller that builds a
  // new array each render would otherwise loop forever
  const orderKey = order.join("\u0000");
  const [seenOrderKey, setSeenOrderKey] = useState(orderKey);
  if (orderKey !== seenOrderKey && !draggingId) {
    setSeenOrderKey(orderKey);
    setDisplayOrder(order);
  }

  const recordTops = useCallback(() => {
    prevTopsRef.current.clear();
    for (const id of displayOrderRef.current) {
      const el = itemElementsRef.current.get(id);
      if (el) {
        prevTopsRef.current.set(id, el.getBoundingClientRect().top);
      }
    }
  }, []);

  // The dragged row follows the pointer: the pointer's travel minus how far its own slot has
  // moved. Its slot comes from the order on screen, so this runs again after each reorder
  // commits; using the next order before React moves the row made it jump one row (the jitter)
  const followPointer = useCallback(() => {
    const dragging = draggingIdRef.current;
    if (!dragging) return;
    const el = itemElementsRef.current.get(dragging);
    if (!el) return;
    const slotTop = (index: number) =>
      itemRectsRef.current.get(startOrderRef.current[index]!)?.top ?? 0;
    const index = displayOrderRef.current.indexOf(dragging);
    const startIndex = startOrderRef.current.indexOf(dragging);
    const dy = lastYRef.current - startYRef.current;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy - (slotTop(index) - slotTop(startIndex))}px)`;
  }, []);

  // The other rows slide into their new places after each reorder (FLIP)
  useLayoutEffect(() => {
    followPointer();
    const oldTops = prevTopsRef.current;
    if (prefersReducedMotion() || oldTops.size === 0) {
      oldTops.clear();
      return;
    }
    const rows: Array<[HTMLElement, number]> = [];
    for (const [id, oldTop] of oldTops) {
      const el = itemElementsRef.current.get(id);
      if (el && id !== draggingIdRef.current) rows.push([el, oldTop]);
    }
    oldTops.clear();
    const cleanups = slideMovedRows(rows);
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [displayOrder, followPointer]);

  /** A pointer event from another finger or pen than the one dragging. */
  const otherPointer = useCallback(
    (e: { pointerId?: number }) =>
      activePointerIdRef.current !== null &&
      e.pointerId !== undefined &&
      e.pointerId !== activePointerIdRef.current,
    [],
  );

  const endDrag = useCallback(() => {
    releasePointer(handleElementRef.current, activePointerIdRef.current);
    setDraggingId(null);
    activePointerIdRef.current = null;
    handleElementRef.current = null;
  }, []);

  // Escape or a lost pointer: everything goes back where it was
  const cancelDrag = useCallback(() => {
    const dragged = draggingIdRef.current;
    const el = dragged ? itemElementsRef.current.get(dragged) : undefined;
    if (el) clearMotion(el);
    setDisplayOrder(startOrderRef.current);
    endDrag();
  }, [endDrag]);

  const handlePointerDown = useCallback((e: ReactPointerEvent, id: T) => {
    if (e.button !== undefined && e.button !== 0) return;

    const handle = e.currentTarget as HTMLElement;
    handleElementRef.current = handle;
    activePointerIdRef.current = e.pointerId ?? 1;

    if (typeof handle.setPointerCapture === "function") {
      try {
        handle.setPointerCapture(e.pointerId ?? 1);
      } catch {}
    }

    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    startOrderRef.current = [...displayOrderRef.current];

    itemRectsRef.current.clear();
    for (const itemId of displayOrderRef.current) {
      const el = itemElementsRef.current.get(itemId);
      if (el) {
        itemRectsRef.current.set(itemId, el.getBoundingClientRect());
      }
    }

    setDraggingId(id);
  }, []);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent | PointerEvent) => {
      const currentDrag = draggingIdRef.current;
      if (!currentDrag) return;
      if (otherPointer(e)) return;

      lastYRef.current = e.clientY;
      followPointer();

      const order = displayOrderRef.current;
      const index = order.indexOf(currentDrag);
      if (index === -1) return;
      const target = targetIndexFor(
        order,
        index,
        e.clientY,
        itemRectsRef.current,
      );
      if (target === index) return;
      recordTops();
      setDisplayOrder(moveItem(order, index, target));
    },
    [recordTops, followPointer, otherPointer],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent | PointerEvent) => {
      const currentDrag = draggingIdRef.current;
      if (!currentDrag || otherPointer(e)) return;
      const el = itemElementsRef.current.get(currentDrag);
      if (el) settleDropped(el, prefersReducedMotion());
      const finalOrder = displayOrderRef.current;
      endDrag();
      onCommitRef.current(finalOrder);
    },
    [otherPointer, endDrag],
  );

  // Window listeners while dragging
  useEffect(() => {
    if (!draggingId) return;

    const onPointerMove = (e: PointerEvent) => handlePointerMove(e);
    const onPointerUp = (e: PointerEvent) => handlePointerUp(e);
    // Capture phase: Escape cancels the drag only, it must not also close Settings
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelDrag();
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [draggingId, handlePointerMove, handlePointerUp, cancelDrag]);

  const getItemProps = useCallback(
    (id: T): SortableItemProps => {
      const isDragging = draggingId === id;
      return {
        ref: (el: HTMLElement | null) => {
          if (el) itemElementsRef.current.set(id, el);
          else itemElementsRef.current.delete(id);
        },
        className: isDragging
          ? "relative z-10 bg-surface-elevated shadow-[0_8px_24px_rgba(0,0,0,0.18)] scale-[1.02] rounded-lg cursor-grabbing"
          : undefined,
        "data-sortable-id": id,
      };
    },
    [draggingId],
  );

  const getHandleProps = useCallback(
    (id: T): SortableHandleProps => ({
      onPointerDown: (e: ReactPointerEvent) => handlePointerDown(e, id),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: cancelDrag,
      className: "touch-none",
      "aria-hidden": true,
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp, cancelDrag],
  );

  const move = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        fromIndex >= displayOrderRef.current.length ||
        toIndex < 0 ||
        toIndex >= displayOrderRef.current.length
      ) {
        return;
      }
      recordTops();
      const next = moveItem(displayOrderRef.current, fromIndex, toIndex);
      setDisplayOrder(next);
      onCommitRef.current(next);
    },
    [recordTops],
  );

  return {
    displayOrder,
    draggingId,
    getItemProps,
    getHandleProps,
    move,
  };
}
