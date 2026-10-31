import { useState, type ReactElement } from "react";
import { t } from "../../../copy";
import { TITLE_MAX } from "../../../domain/edit";
import { Field } from "./Field";
import { CONTROL_CLASS } from "./control";

export interface TitleFieldProps {
  value: string;
  onSave: (title: string) => void;
}

export function TitleField({ value, onSave }: TitleFieldProps): ReactElement {
  const [title, setTitle] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setTitle(value);
  }

  const handleBlur = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(value);
      setError(t("task.title_required"));
      return;
    }
    setError(null);
    if (trimmed !== value) {
      onSave(trimmed);
    }
  };

  return (
    <Field id="task-title" label={t("task.title")} error={error}>
      <textarea
        id="task-title"
        rows={1}
        maxLength={TITLE_MAX}
        value={title}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "task-title-error" : undefined}
        className={`input focus-ring min-h-[52px] resize-none py-3 font-serif text-title font-semibold placeholder:text-ink-tertiary aria-invalid:border-error [field-sizing:content] ${CONTROL_CLASS}`}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </Field>
  );
}
