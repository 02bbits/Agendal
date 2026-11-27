import { BackBarSkeleton } from "../../components/BackBar";

const ROWS = ["45%"];

/**
 * A note's result while it loads (RV, after 300 ms): the same blocks as the result itself, in the
 * fill colours of the other skeletons, so it shows on a popup's surface as on the page.
 */
export function NoteResultSkeleton({ page }: { page: boolean }) {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="note-result-loading"
      className="flex animate-pulse flex-col gap-4 pb-8"
    >
      {page && <BackBarSkeleton />}
      {/* "TODAY 12:06 · 1 TASK MADE", then the title with Rename and Delete */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="h-3 w-40 rounded-md bg-fill/60" />
        <div className="flex items-center gap-4">
          <div className="h-8 w-1/2 rounded-xl bg-fill/80" />
          <div className="ml-auto size-6 shrink-0 rounded-md bg-fill/50" />
          <div className="size-6 shrink-0 rounded-md bg-fill/50" />
        </div>
      </div>
      {/* The note's words */}
      <div className="flex flex-col gap-3 rounded-2xl border border-separator/50 px-6 py-5">
        <div className="h-4 w-1/2 rounded-lg bg-fill/60" />
        <div className="h-4 w-2/5 rounded-lg bg-fill/60" />
      </div>
      {/* The tasks it made or changed */}
      <div className="overflow-hidden rounded-2xl border border-separator/50">
        {ROWS.map((width) => (
          <div
            key={width}
            className="flex items-center gap-3 border-b border-separator/40 px-5 py-4 last:border-b-0"
          >
            <div className="h-6 w-20 shrink-0 rounded-full bg-fill/70" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 rounded-xl bg-fill/80" style={{ width }} />
              <div className="h-3 w-32 rounded-lg bg-fill/60" />
            </div>
            <div className="size-5 shrink-0 rounded-md bg-fill/50" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-6">
        <div className="h-11 flex-1 rounded-xl bg-fill/60" />
        <div className="h-11 flex-1 rounded-xl bg-fill/80" />
      </div>
    </div>
  );
}
