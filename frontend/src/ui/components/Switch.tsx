import { useId, type ReactNode } from "react";

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: ReactNode;
}

/** A settings row with a switch; the whole row is the 44px target. */
export function Switch({
  label,
  checked,
  onChange,
  disabled,
  icon,
}: SwitchProps) {
  const id = useId();
  return (
    <div className="flex min-h-11 w-full items-center gap-3 border-b border-separator py-1 text-left text-body text-ink">
      {icon && (
        <span className="inline-flex text-ink-secondary" aria-hidden="true">
          {icon}
        </span>
      )}
      <label className="flex-1" htmlFor={id}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="group/switch focus-ring relative h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full border-0 bg-fill p-0 shadow-[inset_0_0_0_1px_var(--color-control)] aria-checked:bg-primary aria-checked:shadow-none disabled:opacity-40"
        onClick={() => onChange(!checked)}
      >
        <span
          className="absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-knob transition-transform duration-[180ms] group-aria-checked/switch:translate-x-5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
