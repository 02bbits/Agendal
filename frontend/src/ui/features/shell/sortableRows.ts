/** How a row slides into its new place, and how the dropped row settles. */
const SLIDE = "transform 200ms cubic-bezier(.2,.7,.3,1)";

/** The list with one item taken from `from` and put back at `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * Where the dragged row belongs for a pointer at `y`: past every neighbour whose middle it has
 * crossed, down then up. Rects are the rows' places when the drag began.
 */
export function targetIndexFor<T>(
  order: readonly T[],
  index: number,
  y: number,
  rects: Map<T, DOMRect>,
): number {
  const middle = (id: T | undefined) => {
    const rect = id === undefined ? undefined : rects.get(id);
    return rect ? rect.top + rect.height / 2 : undefined;
  };
  let target = index;
  while (target < order.length - 1) {
    const below = middle(order[target + 1]);
    if (below === undefined || y <= below) break;
    target++;
  }
  while (target > 0) {
    const above = middle(order[target - 1]);
    if (above === undefined || y >= above) break;
    target--;
  }
  return target;
}

/** A row goes back to its resting place, with no motion of its own left. */
export function clearMotion(el: HTMLElement) {
  el.style.transition = "";
  el.style.transform = "";
}

/** The dropped row slides from under the pointer into its slot (at once with reduced motion). */
export function settleDropped(el: HTMLElement, reduced: boolean) {
  if (reduced) {
    clearMotion(el);
    return;
  }
  el.style.transition = SLIDE;
  el.style.transform = "none";
  const onEnd = () => {
    clearMotion(el);
    el.removeEventListener("transitionend", onEnd);
  };
  el.addEventListener("transitionend", onEnd);
}

/**
 * FLIP: each row that moved starts where it was (`oldTops`) and slides to its new place. A row
 * may still be sliding from the last move: its new top is read with that slide taken off first,
 * or it jumps (the jitter). Returns the listeners to remove.
 */
export function slideMovedRows(
  rows: Array<[HTMLElement, number]>,
): Array<() => void> {
  for (const [el] of rows) {
    el.style.transition = "none";
    el.style.transform = "none";
  }
  const cleanups: Array<() => void> = [];
  for (const [el, oldTop] of rows) {
    const delta = oldTop - el.getBoundingClientRect().top;
    if (delta === 0) continue;
    el.style.transform = `translateY(${delta}px)`;
    void el.offsetHeight; // Force a reflow, so the slide starts from there
    el.style.transition = SLIDE;
    el.style.transform = "none";
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === "transform") clearMotion(el);
    };
    el.addEventListener("transitionend", onEnd);
    cleanups.push(() => el.removeEventListener("transitionend", onEnd));
  }
  return cleanups;
}

/** Lets go of the pointer the drag held, if the browser held it. */
export function releasePointer(
  handle: HTMLElement | null,
  pointerId: number | null,
) {
  if (
    !handle ||
    pointerId === null ||
    typeof handle.releasePointerCapture !== "function"
  )
    return;
  try {
    handle.releasePointerCapture(pointerId);
  } catch {}
}
