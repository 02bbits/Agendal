import type { ReactElement } from "react";
import { cx } from "./cx";
import { CheckIcon } from "./icons";

/**
 * One checkbox under a dialog's question (#168): Move to No project when deleting a project,
 * Sign out on all devices. It sits as far from the text above as from the buttons below.
 *
 * A button with the checkbox role, not a native box in a label: every click flips it, fast
 * clicks and double clicks included, the same in every browser, and the words never get selected.
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
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring mt-3 flex cursor-pointer select-none items-center gap-3 rounded-field border-0 bg-transparent p-0 text-left"
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors",
          checked
            ? "border-primary bg-primary text-primary-content"
            : "border-ink-tertiary",
        )}
      >
        {checked && <CheckIcon size={14} strokeWidth={3} />}
      </span>
      <span className="text-body text-ink">{label}</span>
    </button>
  );
}
