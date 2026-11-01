import { useState, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import { NOTES_MAX } from "../../../domain/edit";
import { Field } from "./Field";
import { CONTROL_CLASS } from "./control";

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
    <Field id="task-notes" label={t("task.notes")}>
      <textarea
        id="task-notes"
        rows={4}
        maxLength={NOTES_MAX}
        value={notes}
        placeholder={t("task.notes_add")}
        className={cx(
          CONTROL_CLASS,
          "textarea focus-ring min-h-[120px] resize-y border py-3 placeholder:text-ink-tertiary aria-invalid:border-error disabled:opacity-40 [field-sizing:content]",
        )}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
      />
    </Field>
  );
}
