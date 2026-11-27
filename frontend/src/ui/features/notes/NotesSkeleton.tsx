import { t } from "../../copy";

// Taken from Inbox's skeleton (app/skeletons.tsx): the same section title, card and rows, with a
// note row's shape (a small icon, title and excerpt, the status on the right)
const ROW_WIDTHS = ["55%", "70%", "40%"];

function SkeletonSection({ rows }: { rows: string[] }) {
  return (
    <div>
      <div className="mt-2 mb-2.5 h-5 w-24 rounded-lg bg-fill/70" />
      <div className="overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-xs">
        {rows.map((width) => (
          <div
            key={width}
            className="flex items-center gap-3 border-b border-separator/40 px-4 py-3.5 last:border-b-0"
          >
            <div className="size-5 shrink-0 rounded-md bg-fill/80" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 rounded-xl bg-fill/80" style={{ width }} />
              <div className="h-3 w-28 rounded-lg bg-fill/60" />
            </div>
            <div className="ml-auto h-4 w-12 shrink-0 rounded-full bg-fill/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The note list while it loads. */
export function NotesRowsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("nav.notes")}
      data-testid="notes-loading"
      className="flex flex-col gap-6 animate-pulse"
    >
      <SkeletonSection rows={ROW_WIDTHS} />
      <SkeletonSection rows={ROW_WIDTHS.slice(0, 2)} />
    </div>
  );
}

/** The Notes screen from the tap on its tab until it is there: the filter chips, then the list. */
export function NotesSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="my-4 flex gap-2 animate-pulse">
        <div className="h-8 w-12 rounded-full bg-fill/80" />
        <div className="h-8 w-20 rounded-full bg-fill/60" />
        <div className="h-8 w-20 rounded-full bg-fill/60" />
      </div>
      <NotesRowsSkeleton />
    </div>
  );
}
