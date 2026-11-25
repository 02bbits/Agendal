import { useDndContext } from "@dnd-kit/core";
import type { ReactNode } from "react";

/**
 * A list that hides when empty still shows while a task is dragged, so it can take the drop
 * (an empty Today, an empty No date, #178).
 */
export function ShownWhileDragging({
  shown,
  children,
}: {
  shown: boolean;
  children: ReactNode;
}) {
  const { active } = useDndContext();
  return shown || active ? <>{children}</> : null;
}
