"use client";

import { cx, TASK_COLUMN_CLASS } from "@/ui";

// The skeleton of each list screen (#161), shared by the screen while its data loads and by the
// app as soon as one is tapped, so a single skeleton runs from the tap to the data.

/** Inbox: the progress card and sections of rows. */
export function InboxSkeleton() {
  return (
    <div
      data-testid="inbox-loading"
      className={cx("flex flex-col gap-6 animate-pulse", TASK_COLUMN_CLASS)}
    >
      {/* Progress summary card skeleton */}
      <div className="flex items-center gap-4.5 rounded-2xl border border-separator/50 bg-surface p-4.5 shadow-xs">
        <div className="size-14 shrink-0 rounded-full bg-fill/80" />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-36 rounded-xl bg-fill/80" />
          <div className="h-3.5 w-48 rounded-lg bg-fill/60" />
        </div>
      </div>

      {/* Section 1: Today skeleton */}
      <div>
        <div className="mb-2.5 mt-2 h-5 w-24 rounded-lg bg-fill/70" />
        <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
            >
              <div className="size-5 shrink-0 rounded-full bg-fill/80" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div
                  className="h-4 rounded-xl bg-fill/80"
                  style={{
                    width: i === 1 ? "55%" : i === 2 ? "70%" : "40%",
                  }}
                />
                <div className="h-3 w-28 rounded-lg bg-fill/60" />
              </div>
              <div className="ml-auto h-4 w-12 shrink-0 rounded-full bg-fill/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Upcoming: the week strip and day groups, or the board's columns. */
export function UpcomingSkeleton({ board }: { board: boolean }) {
  return board ? (
    <div
      className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-pulse"
      data-testid="upcoming-loading"
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 w-28 rounded-full bg-separator/40" />
          <div className="space-y-3 rounded-2xl border border-separator/40 bg-surface p-4 shadow-xs">
            <div className="h-5 w-3/4 rounded-full bg-separator/30" />
            <div className="h-5 w-1/2 rounded-full bg-separator/30" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div
      data-testid="upcoming-loading"
      className={cx("flex flex-col gap-6 animate-pulse", TASK_COLUMN_CLASS)}
    >
      {/* Week navigation placeholder */}
      <div className="border-b border-separator/50 pb-3">
        <div className="flex items-center justify-between py-2">
          <div className="h-7 w-32 rounded-lg bg-fill/80" />
          <div className="h-8 w-44 rounded-full bg-fill/60" />
        </div>
        <div className="grid grid-cols-7 gap-1 pt-1">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-1 rounded-xl py-2"
            >
              <div className="h-3 w-6 rounded bg-fill/60" />
              <div className="h-6 w-6 rounded-md bg-fill/80" />
            </div>
          ))}
        </div>
      </div>

      {/* Day 1 Section */}
      <div className="space-y-2">
        <div className="h-4 w-36 rounded-lg bg-fill/70" />
        <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
            >
              <div className="size-5 shrink-0 rounded-full bg-fill/80" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div
                  className="h-4 rounded-xl bg-fill/80"
                  style={{ width: i === 1 ? "60%" : "40%" }}
                />
                <div className="h-3 w-28 rounded-lg bg-fill/60" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day 2 Section */}
      <div className="space-y-2">
        <div className="h-4 w-40 rounded-lg bg-fill/70" />
        <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
            >
              <div className="size-5 shrink-0 rounded-full bg-fill/80" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div
                  className="h-4 rounded-xl bg-fill/80"
                  style={{ width: i === 1 ? "50%" : "70%" }}
                />
                <div className="h-3 w-24 rounded-lg bg-fill/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Projects: the project cards. */
export function ProjectsSkeleton() {
  return (
    <div
      data-testid="projects-loading"
      className="grid grid-cols-1 gap-4 [html[data-page-view='full']_&]:sm:grid-cols-2 [html[data-page-view='full']_&]:lg:grid-cols-3 [html[data-page-view='full']_&]:xl:grid-cols-4 animate-pulse"
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-separator/50 bg-surface p-5 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-3 shrink-0 rounded-full bg-fill/80" />
            <div
              className="h-5 rounded-xl bg-fill/80"
              style={{ width: i % 2 === 0 ? "60%" : "45%" }}
            />
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-fill/60" />
          <div className="h-3.5 w-24 rounded-lg bg-fill/50" />
        </div>
      ))}
    </div>
  );
}

/** One project: its header, progress and rows. */
export function ProjectSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cx(
        "flex animate-pulse flex-col gap-4 pb-8",
        TASK_COLUMN_CLASS,
      )}
    >
      <div className="flex items-center justify-between py-2">
        <div className="h-8 w-20 rounded-full bg-fill/80" />
      </div>
      <div className="mt-2 mb-3 flex items-center gap-3">
        <div className="size-3 shrink-0 rounded-full bg-fill/80" />
        <div className="h-7 w-48 rounded-xl bg-fill/80" />
      </div>
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-1.5 w-full rounded-full bg-fill/80" />
        <div className="h-3.5 w-28 rounded-lg bg-fill/60" />
      </div>
      <div className="rounded-2xl border border-separator/50 bg-surface shadow-xs overflow-hidden">
        <div className="flex flex-col">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
            >
              <div className="size-5 shrink-0 rounded-full bg-fill/80" />
              <div
                className="h-4 rounded-xl bg-fill/80"
                style={{ width: i === 1 ? "55%" : i === 2 ? "70%" : "40%" }}
              />
              <div className="ml-auto h-4 w-16 shrink-0 rounded-full bg-fill/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
