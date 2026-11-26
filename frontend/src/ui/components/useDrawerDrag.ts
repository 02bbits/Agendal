import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

/** Below this share of the screen, a drawer let go closes. */
const CLOSE_BELOW = 0.25;

/**
 * The grabber of a bottom drawer: on a phone, dragging it sets how far the drawer is open, and
 * letting go low enough closes it. From 768px the drawer keeps its set height (UX-27).
 */
export function useDrawerDrag(onClose: () => void): {
  style: CSSProperties | undefined;
  grabber: {
    onPointerDown(event: PointerEvent<HTMLElement>): void;
    onPointerMove(event: PointerEvent<HTMLElement>): void;
    onPointerUp(event: PointerEvent<HTMLElement>): void;
    onPointerCancel(event: PointerEvent<HTMLElement>): void;
  };
} {
  const [height, setHeight] = useState<number | null>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const heightAt = (event: PointerEvent<HTMLElement>) =>
    drag.current ? drag.current.height + drag.current.y - event.clientY : 0;

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
    if (drag.current) setHeight(heightAt(event));
  }
  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    const low = heightAt(event) < window.innerHeight * CLOSE_BELOW;
    drag.current = null;
    if (low) {
      setHeight(null);
      onClose();
    }
  }

  return {
    // The drawer's CSS max and min heights still hold while dragging
    style: height === null ? undefined : { height: `${height}px` },
    grabber: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
