import { t } from "../../copy";
import { IconButton } from "../../components/IconButton";
import { MicIcon, PencilIcon, PlusIcon } from "../../components/icons";

export interface CaptureBarProps {
  /** Opens the note editor (NC, another owner's screen). */
  onWrite: () => void;
  /** Opens the editor with dictation; hidden when the browser can't dictate. */
  onDictate?: () => void;
  /** Opens the New task sheet; the + is hidden until there is one (IM-26). */
  onAdd?: () => void;
}

/** Floating "Write a note…" bar above the tabs, with the square + beside it. */
export function CaptureBar({ onWrite, onDictate, onAdd }: CaptureBarProps) {
  return (
    <div className="flex items-center gap-2 px-5 py-2">
      <div className="flex h-[52px] flex-1 items-center rounded-field border border-control bg-surface pr-1 pl-4 shadow-sm">
        <button
          type="button"
          className="focus-ring flex h-full flex-1 cursor-text items-center gap-2 rounded-tile border-0 bg-transparent text-left text-body text-ink-tertiary"
          aria-label={t("note.capture_open")}
          onClick={onWrite}
        >
          <PencilIcon size={18} />
          <span aria-hidden="true">{t("note.placeholder")}</span>
        </button>
        {onDictate && (
          <IconButton
            plain
            label={t("note.mic")}
            icon={<MicIcon size={18} />}
            onClick={onDictate}
          />
        )}
      </div>
      {onAdd && (
        <IconButton
          className="rounded-field! bg-transparent!"
          label={t("task.add_by_hand")}
          icon={<PlusIcon />}
          onClick={onAdd}
        />
      )}
    </div>
  );
}
