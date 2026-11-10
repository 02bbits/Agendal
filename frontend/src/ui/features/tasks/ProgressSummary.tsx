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
  if (total === 0) return null;
  const left = total - done;
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const share = total ? done / total : 0;
  const countText = `${done}/${total}`;
  const textSizeClass = countText.length > 5 ? "text-[11px]" : "text-[13px]";

  return (
    <section className="mb-6 flex items-center gap-4.5 rounded-2xl border border-separator/50 bg-surface p-4.5 shadow-xs">
      <svg
        className="shrink-0"
        width="56"
        height="56"
        viewBox="0 0 52 52"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="26"
          cy="26"
          r={r}
          className="fill-none stroke-fill-2 stroke-[3.5]"
        />
        <circle
          cx="26"
          cy="26"
          r={r}
          className="fill-none stroke-primary stroke-[3.5] [stroke-linecap:round] transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          transform="rotate(-90 26 26)"
        />
        <text
          x="26"
          y="26"
          className={`fill-ink ${textSizeClass} font-bold`}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {countText}
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
