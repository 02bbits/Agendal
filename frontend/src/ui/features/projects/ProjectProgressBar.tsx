import { t } from "../../copy";
import type { ProjectColor } from "../../domain/types";

export interface ProjectProgressBarProps {
  colour: ProjectColor;
  done: number;
  total: number;
}

export function ProjectProgressBar({
  colour,
  done,
  total,
}: ProjectProgressBarProps) {
  const share = total ? (done / total) * 100 : 0;
  return (
    <div className="mb-6 flex flex-col gap-1.5 [&_p]:m-0">
      <span
        className="block h-1.5 overflow-hidden rounded-full bg-fill"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-[inherit]"
          style={{
            width: `${share}%`,
            background: `var(--color-project-${colour})`,
          }}
        />
      </span>
      <p className="text-footnote text-ink-secondary">
        {t("project.progress", { done, total })}
      </p>
    </div>
  );
}
