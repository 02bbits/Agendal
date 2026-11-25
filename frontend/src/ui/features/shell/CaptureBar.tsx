import { t } from "../../copy";
import { IconButton } from "../../components/IconButton";
import { MicIcon, PlusIcon, SparklesIcon } from "../../components/icons";

export interface CaptureBarProps {
  /** Opens the note editor (NC, another owner's screen). */
  onWrite: () => void;
  /** Opens the editor with dictation; hidden when the browser can't dictate. */
  onDictate?: () => void;
  /** Opens the New task sheet; the + is hidden until there is one (IM-26). */
  onAdd?: () => void;
}

/**
 * Floating "Write a note…" bar above the tabs. The round button beside it dictates (NC-3); where the browser
 * can't record, it is the + for a task by hand (IM-26) as before.
 */
export function CaptureBar({ onWrite, onDictate, onAdd }: CaptureBarProps) {
  const round = onDictate ?? onAdd;
  return (
    <div
      className={`grid items-center gap-2 px-gutter py-2 mb-1 md:px-gutter-wide ${round ? "grid-cols-[minmax(0,1fr)_50px]" : "grid-cols-[minmax(0,1fr)]"}`}
    >
      <div className="flex h-[50px] min-w-0 items-center rounded-full border border-separator bg-surface-elevated pr-1 pl-4 shadow-sm">
        <button
          type="button"
          className="focus-ring flex h-full flex-1 cursor-text items-center gap-2 rounded-tile border-0 bg-transparent text-left text-body text-ink-tertiary"
          aria-label={t("note.capture_open")}
          onClick={onWrite}
        >
          <SparklesIcon size={18} />
          <span className="truncate" aria-hidden="true">
            {t("note.placeholder")}
          </span>
        </button>
      </div>
      {round && (
        <IconButton
          className="size-[50px]! min-h-[50px]! bg-primary! text-primary-content!"
          label={t(onDictate ? "note.mic" : "task.add_by_hand")}
          icon={onDictate ? <MicIcon /> : <PlusIcon />}
          onClick={round}
        />
      )}
    </div>
  );
}
