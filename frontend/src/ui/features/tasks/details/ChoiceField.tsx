import type { ReactElement } from "react";

export interface ChoiceOption<V extends string> {
  value: V;
  label: string;
}

export interface ChoiceFieldProps<V extends string> {
  id: string;
  label: string;
  value: V;
  options: readonly ChoiceOption<V>[];
  disabled?: boolean;
  helper?: string;
  onChange: (value: V) => void;
}

export function ChoiceField<V extends string>({
  id,
  label,
  value,
  options,
  disabled,
  helper,
  onChange,
}: ChoiceFieldProps<V>): ReactElement {
  const helperId = helper ? `${id}-helper` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-footnote font-medium text-ink-secondary"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={helperId}
        onChange={(e) => onChange(e.target.value as V)}
        className="focus-ring h-[52px] w-full cursor-pointer rounded-field border border-control bg-surface px-4 text-body text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helper && (
        <p id={helperId} className="m-0 text-footnote text-ink-secondary">
          {helper}
        </p>
      )}
    </div>
  );
}
