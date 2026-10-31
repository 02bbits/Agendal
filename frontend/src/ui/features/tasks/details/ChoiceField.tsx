import type { ReactElement, ReactNode } from "react";
import { cx } from "../../../components/cx";
import { Field } from "./Field";
import { CONTROL_CLASS } from "./control";

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
  helper?: ReactNode;
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
    <Field id={id} label={label} helper={helper} helperId={helperId}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={helperId}
        onChange={(e) => onChange(e.target.value as V)}
        className={cx(
          CONTROL_CLASS,
          "focus-ring cursor-pointer border disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
