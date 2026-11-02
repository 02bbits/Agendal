export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

export interface PopoverPosition {
  top: number;
  left: number;
  minWidth: number;
}

/** Space kept between a popover and the window edge, and below its trigger. */
export const POPOVER_MARGIN = 8;
const GAP = 6;

/**
 * Places a popover of `width`×`height` next to its trigger so it stays
 * inside a `vw`×`vh` window: under the trigger, or above it when there is
 * no room below, and pushed back in from the left and right edges.
 */
export function placePopover(
  trigger: Rect,
  width: number,
  height: number,
  vw: number,
  vh: number,
  align: "left" | "right",
): PopoverPosition {
  const w = Math.max(width, trigger.width);
  let left = align === "right" ? trigger.right - w : trigger.left;
  left = Math.min(left, vw - POPOVER_MARGIN - w);
  left = Math.max(left, POPOVER_MARGIN);

  let top = trigger.bottom + GAP;
  const above = trigger.top - GAP - height;
  if (top + height > vh - POPOVER_MARGIN && above >= POPOVER_MARGIN) {
    top = above;
  } else {
    top = Math.max(POPOVER_MARGIN, Math.min(top, vh - POPOVER_MARGIN - height));
  }
  return { top, left, minWidth: trigger.width };
}
