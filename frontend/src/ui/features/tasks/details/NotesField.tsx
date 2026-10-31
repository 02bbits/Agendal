import { useState, type ReactElement } from "react";
import { t } from "../../../copy";
import { NOTES_MAX } from "../../../domain/edit";

export interface NotesFieldProps {
  value: string | null;
  onSave: (notes: string | null) => void;
}

export function NotesField({ value, onSave }: NotesFieldProps): ReactElement {
  const [notes, setNotes] = useState(value ?? "");
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setNotes(value ?? "");
  }

  const handleBlur = () => {
    const trimmed = notes.trim() ? notes : null;
    const prevTrimmed = value?.trim() ? value : null;
    if (trimmed !== prevTrimmed) {
      onSave(trimmed);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="task-notes"
        className="text-footnote font-medium text-ink-secondary"
      >
        {t("task.notes")}
      </label>
      <textarea
        id="task-notes"
        rows={4}
        maxLength={NOTES_MAX}
        value={notes}
        placeholder={t("task.notes_add")}
        className="textarea focus-ring min-h-[120px] w-full resize-y rounded-field border border-control bg-surface px-4 py-3 text-body text-ink placeholder:text-ink-tertiary [field-sizing:content]"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
}
