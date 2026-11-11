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

/** Floating "Write a note…" bar above the tabs, with the round + beside it. */
export function CaptureBar({ onWrite, onDictate, onAdd }: CaptureBarProps) {
  return (
    <div
      className={`grid items-center gap-2 px-gutter py-2 mb-1 md:px-gutter-wide ${onAdd ? "grid-cols-[minmax(0,1fr)_50px]" : "grid-cols-[minmax(0,1fr)]"}`}
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
        {onDictate && (
          <IconButton
            className="size-9! min-h-9! bg-primary-tint!"
            label={t("note.mic")}
            icon={<MicIcon size={18} />}
            onClick={onDictate}
          />
        )}
      </div>
      {onAdd && (
        <IconButton
          className="size-[50px]! min-h-[50px]! bg-primary! text-primary-content!"
          label={t("task.add_by_hand")}
          icon={<PlusIcon />}
          onClick={onAdd}
        />
      )}
    </div>
  );
}
