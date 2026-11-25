import type { CSSProperties, DOMAttributes, ReactNode } from "react";

/** What a sortable list gives its row (#178). */
export interface RowDrag {
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  /** Mouse and touch start a drag anywhere on the row. */
  rowListeners: DOMAttributes<HTMLElement>;
  /** The keyboard's way to pick the row up. */
  handle: ReactNode;
  dragging: boolean;
}
