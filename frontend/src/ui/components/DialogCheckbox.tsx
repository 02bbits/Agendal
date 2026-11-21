import type { ReactElement } from "react";

/**
 * One checkbox under a dialog's question (#168): Move to No project when deleting a project,
 * Sign out on all devices. It sits as far from the text above as from the buttons below.
 */
export function DialogCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label className="mt-3 flex cursor-pointer items-center gap-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
      />
      <span className="text-body text-ink">{label}</span>
    </label>
  );
}
