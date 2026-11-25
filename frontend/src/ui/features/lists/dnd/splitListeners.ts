import type { DOMAttributes, KeyboardEventHandler } from "react";

type Listeners = Record<string, unknown> | undefined;

/**
 * dnd-kit's activator listeners, split (#178): mouse and touch go on the whole row, the
 * keyboard on the move handle only, so Enter on the row's link still opens the task.
 */
export function splitListeners(listeners: Listeners): {
  pointer: DOMAttributes<HTMLElement>;
  keyboard: KeyboardEventHandler<HTMLElement> | undefined;
} {
  const { onKeyDown, ...pointer } = listeners ?? {};
  return {
    pointer: pointer as DOMAttributes<HTMLElement>,
    keyboard: onKeyDown as KeyboardEventHandler<HTMLElement> | undefined,
  };
}
