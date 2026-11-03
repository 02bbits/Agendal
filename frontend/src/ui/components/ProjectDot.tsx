import type { ReactElement } from "react";
import type { ProjectColor } from "../domain/types";

/** The small round colour mark of a project. */
export function ProjectDot({ colour }: { colour: ProjectColor }): ReactElement {
  return (
    <span
      className="block size-2 rounded-full"
      style={{ background: `var(--color-project-${colour})` }}
      aria-hidden="true"
    />
  );
}
