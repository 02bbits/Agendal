import { type ReactElement, useEffect, useRef, useState } from "react";
import { cx } from "../../components/cx";
import { PlusIcon } from "../../components/icons";
import { t } from "../../copy";
import { dayHeading, dayHeadingShort } from "../../domain/week";
import { EntryBlocks } from "./EntryBlocks";
import type { UpcomingBoardProps } from "./types";
import { UpcomingOverdue } from "./UpcomingOverdue";

export function UpcomingBoard({
  days,
  entriesByDay,
  overdueTasks,
  today,
  selectedTaskId,
  navigate,
  onAddTask,
}: UpcomingBoardProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
  });

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role='button']")) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    dragRef.current = {
      isDown: true,
      startX: e.pageX - container.offsetLeft,
      scrollLeft: container.scrollLeft,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isDown) return;
      const container = containerRef.current;
      if (!container) return;

      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = x - dragRef.current.startX;
      container.scrollLeft = dragRef.current.scrollLeft - walk;
    };

    const onMouseUp = () => {
      if (dragRef.current.isDown) {
        dragRef.current.isDown = false;
        setIsDragging(false);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      className={cx(
        "flex gap-4 overflow-x-auto px-2 pt-2 pb-4 cursor-grab",
        isDragging ? "cursor-grabbing select-none snap-none" : "snap-x",
      )}
    >
      {overdueTasks && overdueTasks.length > 0 && (
        <UpcomingOverdue
          variant="board"
          tasks={overdueTasks}
          today={today}
          selectedTaskId={selectedTaskId}
          navigate={navigate}
        />
      )}
      {days.map((date) => {
        const isToday = date === today;
        const shortHeading = dayHeadingShort(date, today);
        const fullHeading = dayHeading(date, today);
        const dayEntries = entriesByDay[date] ?? [];
        const count = dayEntries.length;

        return (
          <section
            key={date}
            aria-label={fullHeading}
            className={cx(
              "flex w-[272px] shrink-0 snap-start flex-col rounded-2xl transition-colors",
              isToday &&
                "bg-surface/30 p-2.5 -m-2.5 border border-primary/25 shadow-xs",
            )}
          >
            <div className="flex items-baseline justify-between gap-1.5 pb-2">
              <h2
                id={"day-" + date}
                className={cx(
                  "m-0 scroll-mt-[calc(var(--upcoming-bar-h,120px)+8px)] text-callout font-semibold",
                  isToday ? "text-ink font-bold" : "text-ink-secondary",
                )}
              >
                {shortHeading}
              </h2>
              <span
                className={cx(
                  "text-footnote font-normal",
                  isToday ? "font-semibold text-ink" : "text-ink-tertiary",
                )}
              >
                {count}
              </span>
            </div>

            {dayEntries.length > 0 && (
              <EntryBlocks
                entries={dayEntries}
                variant="board"
                today={today}
                selectedTaskId={selectedTaskId ?? undefined}
                navigate={navigate}
              />
            )}

            <button
              type="button"
              onClick={() => onAddTask(date)}
              aria-label={t("list.add_task_on", { day: fullHeading })}
              className="focus-ring mt-2 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-callout text-ink-tertiary row-hover hover:text-ink"
            >
              <span className="text-primary">
                <PlusIcon size={16} />
              </span>
              <span>{t("list.add_task")}</span>
            </button>
          </section>
        );
      })}
    </div>
  );
}
