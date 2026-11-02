import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { cx } from "../../../components/cx";
import { t } from "../../../copy";
import { TITLE_MAX } from "../../../domain/edit";

export interface TitleFieldProps {
  value: string;
  onSave: (title: string) => void;
  variant?: "panel" | "screen";
}

export function TitleField({
  value,
  onSave,
  variant = "panel",
}: TitleFieldProps): ReactElement {
  const [title, setTitle] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setTitle(value);
  }

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [title, resize]);

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

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value.replace(/\n/g, " "));
    resize();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const isScreen = variant === "screen";

  return (
    <div className="flex flex-1 flex-col">
      <textarea
        ref={textareaRef}
        id="task-title"
        rows={1}
        maxLength={TITLE_MAX}
        value={title}
        aria-label={t("task.title")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "task-title-error" : undefined}
        className={cx(
          "focus-ring w-full resize-none border-0 bg-transparent p-0 text-ink placeholder:text-ink-tertiary focus:outline-none",
          isScreen ? "text-title font-bold" : "text-title font-semibold",
        )}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {error && (
        <p
          id="task-title-error"
          role="alert"
          className="mt-1 text-footnote text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
