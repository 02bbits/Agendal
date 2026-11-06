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
        role="progressbar"
        aria-label={t("project.progress", { done, total })}
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={t("project.progress", { done, total })}
        className="block h-1.5 overflow-hidden rounded-full bg-fill"
      >
        <span
          className="block h-full rounded-[inherit]"
          style={{
            width: `${share}%`,
            background: `var(--color-project-${colour})`,
          }}
        />
      </span>
      <p className="text-footnote text-ink-secondary" aria-hidden="true">
        {t("project.progress", { done, total })}
      </p>
    </div>
  );
}
