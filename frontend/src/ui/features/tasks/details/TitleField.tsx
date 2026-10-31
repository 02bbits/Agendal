import { useState, type ReactElement } from "react";
import { t } from "../../../copy";
import { TITLE_MAX } from "../../../domain/edit";

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
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="task-title"
        className="text-footnote font-medium text-ink-secondary"
      >
        {t("task.title")}
      </label>
      <textarea
        id="task-title"
        rows={1}
        maxLength={TITLE_MAX}
        value={title}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "task-title-error" : undefined}
        className="input focus-ring min-h-[52px] w-full resize-none rounded-field border-control bg-surface px-4 py-3 font-serif text-title font-semibold text-ink placeholder:text-ink-tertiary aria-invalid:border-error [field-sizing:content]"
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      {error && (
        <p
          id="task-title-error"
          role="alert"
          className="m-0 text-footnote text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
