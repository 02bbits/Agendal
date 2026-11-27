import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

/** Let go below this share of the screen, the drawer closes. */
const CLOSE_ON_RELEASE = 0.25;
/** Dragged down to this share of the screen (the bottom), it closes at once. */
const CLOSE_AT_BOTTOM = 0.12;

/**
 * The grabber of a bottom drawer: on a phone, dragging it sets how far the drawer is open (its
 * contents shrink to fit). Let go low, or dragged to the bottom, it closes through `onClose` (which
 * may ask first). From 768px the drawer keeps its set height (UX-27).
 */
export function useDrawerDrag(onClose: () => void): {
  style: CSSProperties | undefined;
  /** The drawer was dragged to a height of its own. */
  dragged: boolean;
  grabber: {
    onPointerDown(event: PointerEvent<HTMLElement>): void;
    onPointerMove(event: PointerEvent<HTMLElement>): void;
    onPointerUp(event: PointerEvent<HTMLElement>): void;
    onPointerCancel(): void;
  };
} {
  const [height, setHeight] = useState<number | null>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const heightAt = (event: PointerEvent<HTMLElement>) =>
    drag.current ? drag.current.height + drag.current.y - event.clientY : 0;

  function close() {
    drag.current = null;
    setHeight(null);
    onClose();
  }
  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const drawer = event.currentTarget.parentElement;
    if (!drawer) return;
    drag.current = {
      y: event.clientY,
      height: drawer.getBoundingClientRect().height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    const next = heightAt(event);
    if (next <= window.innerHeight * CLOSE_AT_BOTTOM) close();
    else setHeight(next);
  }
  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    if (heightAt(event) < window.innerHeight * CLOSE_ON_RELEASE) close();
    else drag.current = null;
  }

  return {
    // The drawer's CSS max and min heights still hold while dragging
    style: height === null ? undefined : { height: `${height}px` },
    dragged: height !== null,
    grabber: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => {
        drag.current = null;
      },
    },
  };
}
