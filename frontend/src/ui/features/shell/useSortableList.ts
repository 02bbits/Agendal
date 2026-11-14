import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

export interface UseSortableListOptions<T extends string> {
  order: T[];
  onCommit: (next: T[]) => void;
}

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

  // FLIP animation on displayOrder change
  useLayoutEffect(() => {
    followPointer();
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || prevTopsRef.current.size === 0) {
      prevTopsRef.current.clear();
      return;
    }

    const currentDragging = draggingIdRef.current;
    const cleanups: Array<() => void> = [];

    // A row may still be sliding from the last move. Its old top was read where it showed
    // (mid-slide); its new top must be read without that slide, or it jumps (the jitter)
    const moving: Array<[HTMLElement, number]> = [];
    for (const [id, oldTop] of prevTopsRef.current.entries()) {
      if (id === currentDragging) continue;
      const el = itemElementsRef.current.get(id);
      if (!el) continue;
      el.style.transition = "none";
      el.style.transform = "none";
      moving.push([el, oldTop]);
    }

    for (const [el, oldTop] of moving) {
      const newTop = el.getBoundingClientRect().top;
      const delta = oldTop - newTop;

      if (delta !== 0) {
        el.style.transition = "none";
        el.style.transform = `translateY(${delta}px)`;

        // Force reflow
        void el.offsetHeight;

        el.style.transition = "transform 200ms cubic-bezier(.2,.7,.3,1)";
        el.style.transform = "none";

        const onTransitionEnd = (e: TransitionEvent) => {
          if (e.target === el && e.propertyName === "transform") {
            el.style.transition = "";
            el.style.transform = "";
          }
        };
        el.addEventListener("transitionend", onTransitionEnd);
        cleanups.push(() => {
          el.removeEventListener("transitionend", onTransitionEnd);
        });
      }
    }

    prevTopsRef.current.clear();

    return () => {
      cleanups.forEach((c) => c());
    };
  }, [displayOrder, followPointer]);

  const cancelDrag = useCallback(() => {
    const draggedEl = draggingIdRef.current
      ? itemElementsRef.current.get(draggingIdRef.current)
      : null;
    if (draggedEl) {
      draggedEl.style.transition = "";
      draggedEl.style.transform = "";
    }
    if (
      handleElementRef.current &&
      activePointerIdRef.current !== null &&
      typeof handleElementRef.current.releasePointerCapture === "function"
    ) {
      try {
        handleElementRef.current.releasePointerCapture(
          activePointerIdRef.current,
        );
      } catch {}
    }
    setDisplayOrder(startOrderRef.current);
    setDraggingId(null);
    activePointerIdRef.current = null;
    handleElementRef.current = null;
  }, []);

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
      if (
        activePointerIdRef.current !== null &&
        e.pointerId !== undefined &&
        e.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      lastYRef.current = e.clientY;
      followPointer();

      const currentOrder = displayOrderRef.current;
      const currentIndex = currentOrder.indexOf(currentDrag);
      if (currentIndex === -1) return;

      let targetIndex = currentIndex;

      // Check downward movement
      while (targetIndex < currentOrder.length - 1) {
        const neighborId = currentOrder[targetIndex + 1];
        const neighborRect = itemRectsRef.current.get(neighborId);
        if (
          neighborRect &&
          e.clientY > neighborRect.top + neighborRect.height / 2
        ) {
          targetIndex++;
        } else {
          break;
        }
      }

      // Check upward movement
      while (targetIndex > 0) {
        const neighborId = currentOrder[targetIndex - 1];
        const neighborRect = itemRectsRef.current.get(neighborId);
        if (
          neighborRect &&
          e.clientY < neighborRect.top + neighborRect.height / 2
        ) {
          targetIndex--;
        } else {
          break;
        }
      }

      if (targetIndex !== currentIndex) {
        recordTops();
        const next = [...currentOrder];
        next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, currentDrag);
        setDisplayOrder(next);
      }
    },
    [recordTops, followPointer],
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent | PointerEvent) => {
    const currentDrag = draggingIdRef.current;
    if (!currentDrag) return;
    if (
      activePointerIdRef.current !== null &&
      e.pointerId !== undefined &&
      e.pointerId !== activePointerIdRef.current
    ) {
      return;
    }

    const draggedEl = itemElementsRef.current.get(currentDrag);
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (draggedEl) {
      if (prefersReduced) {
        draggedEl.style.transition = "";
        draggedEl.style.transform = "";
      } else {
        draggedEl.style.transition = "transform 200ms cubic-bezier(.2,.7,.3,1)";
        draggedEl.style.transform = "none";
        const onEnd = () => {
          draggedEl.style.transition = "";
          draggedEl.style.transform = "";
          draggedEl.removeEventListener("transitionend", onEnd);
        };
        draggedEl.addEventListener("transitionend", onEnd);
      }
    }

    if (
      handleElementRef.current &&
      typeof handleElementRef.current.releasePointerCapture === "function" &&
      activePointerIdRef.current !== null
    ) {
      try {
        handleElementRef.current.releasePointerCapture(
          activePointerIdRef.current,
        );
      } catch {}
    }

    const finalOrder = displayOrderRef.current;
    setDraggingId(null);
    activePointerIdRef.current = null;
    handleElementRef.current = null;

    onCommitRef.current(finalOrder);
  }, []);

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
      const next = [...displayOrderRef.current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved!);
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
