import { t } from "../../copy";
import { formatTime } from "../../domain/dates";
import type { Progress } from "../../domain/progress";
import type { Task, TimeFormat } from "../../domain/types";

export interface ProgressSummaryProps {
  progress: Progress;
  next: Task | null;
  timeFormat: TimeFormat;
}

/** Inbox summary: ring "2/6", "2 down, 4 to go!", "Next: … at 16:00". The count is announced politely (UX-62). */
export function ProgressSummary({
  progress,
  next,
  timeFormat,
}: ProgressSummaryProps) {
  const { done, total } = progress;
  const left = total - done;
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const share = total ? done / total : 0;

  return (
    <section className="mb-6 flex items-center gap-3">
      <svg
        className="shrink-0"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="20"
          cy="20"
          r={r}
          className="fill-none stroke-fill stroke-[3]"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          className="fill-none stroke-primary stroke-[3] [stroke-linecap:round] transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          transform="rotate(-90 20 20)"
        />
        <text
          x="20"
          y="20"
          className="fill-ink text-[11px] font-semibold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {`${done}/${total}`}
        </text>
      </svg>
      <div>
        <p className="m-0 text-heading font-semibold">
          {left === 0 && total > 0
            ? t("list.encourage_one")
            : t("list.encourage_progress", { done, left })}
        </p>
        {next && (
          <p className="m-0 text-footnote text-ink-secondary">
            {next.start_time
              ? t("list.next_at", {
                  title: next.title,
                  time: formatTime(next.start_time, timeFormat),
                })
              : t("list.next", { title: next.title })}
          </p>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {t("list.progress", { done, total })}
      </p>
    </section>
  );
}
