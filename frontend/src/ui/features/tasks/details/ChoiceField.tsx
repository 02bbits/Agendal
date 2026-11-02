import type { ReactElement, ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "../../../components/icons";
import { cx } from "../../../components/cx";
import { SettingsRow } from "./SettingsRow";

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
  icon: ReactNode;
  tileBg?: string;
  onChange: (value: V) => void;
  variant?: "panel" | "screen";
}

export function ChoiceField<V extends string>({
  id,
  label,
  value,
  options,
  disabled,
  helper,
  icon,
  tileBg,
  onChange,
  variant = "panel",
}: ChoiceFieldProps<V>): ReactElement {
  const isScreen = variant === "screen";

  const control = (
    <div className="relative inline-flex items-center">
      <select
        id={id}
        aria-label={label}
        value={value}
        disabled={disabled}
        aria-describedby={helper ? `${id}-helper` : undefined}
        onChange={(e) => onChange(e.target.value as V)}
        className={cx(
          "focus-ring cursor-pointer appearance-none border-0 text-ink focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
          isScreen
            ? "bg-transparent py-1 pr-5 text-right text-body text-ink-secondary"
            : "rounded-full bg-fill py-1 pl-3 pr-6 text-footnote font-medium",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isScreen ? (
        <ChevronRightIcon
          size={16}
          className="pointer-events-none absolute right-0 text-ink-tertiary"
        />
      ) : (
        <ChevronDownIcon
          size={14}
          className="pointer-events-none absolute right-2 text-ink-secondary"
        />
      )}
    </div>
  );

  return (
    <SettingsRow
      variant={variant}
      icon={icon}
      tileBg={tileBg}
      label={label}
      control={control}
      helper={helper}
      helperId={helper ? `${id}-helper` : undefined}
    />
  );
}
