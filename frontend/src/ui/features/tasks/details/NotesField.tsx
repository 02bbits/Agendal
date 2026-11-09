import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import { NOTES_MAX } from "../../../domain/edit";

export interface NotesFieldProps {
  value: string | null;
  onSave: (notes: string | null) => void;
  /** Every keystroke, before the blur that saves: a form can tell it was edited (UX-13). */
  onChange?: (notes: string) => void;
  variant?: "panel" | "screen";
}

export function NotesField({
  value,
  onSave,
  onChange,
  variant = "panel",
}: NotesFieldProps): ReactElement {
  const [notes, setNotes] = useState(value ?? "");
  const [prevValue, setPrevValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setNotes(value ?? "");
  }

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 100)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [notes, resize]);

  const handleBlur = () => {
    const trimmed = notes.trim() ? notes : null;
    const prevTrimmed = value?.trim() ? value : null;
    if (trimmed !== prevTrimmed) {
      onSave(trimmed);
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    onChange?.(e.target.value);
    resize();
  };

  const isPanel = variant === "panel";

  return (
    <div className="flex flex-col gap-1.5">
      {isPanel && (
        <label
          htmlFor="task-notes"
          className="text-footnote font-medium text-ink-secondary"
        >
          {t("task.description")}
        </label>
      )}
      <textarea
        ref={textareaRef}
        id="task-notes"
        rows={3}
        maxLength={NOTES_MAX}
        value={notes}
        placeholder={t("task.notes_add")}
        aria-label={t("task.notes")}
        className={cx(
          "focus-ring w-full rounded-field border border-control bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-tertiary disabled:opacity-40",
          !isPanel && "border-0 shadow-xs",
        )}
        onChange={handleInput}
        onBlur={handleBlur}
      />
    </div>
  );
}
