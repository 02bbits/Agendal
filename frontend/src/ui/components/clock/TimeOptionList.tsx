import { cx } from "../cx";
import { CheckIcon } from "../icons";

/** The quarter hours under the typed field; the arrow keys' current one is shaded. */
export function TimeOptionList({
  id,
  label,
  options,
  value,
  active,
  onPick,
}: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  active: number;
  onPick: (time: string) => void;
}) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={label}
      className="flex flex-col gap-0.5 overflow-y-auto p-1"
    >
      {options.map((option, index) => (
        <div
          key={option.value || "none"}
          id={`${id}-${index}`}
          role="option"
          aria-selected={option.value === value}
          ref={(el) => {
            if (el && index === active)
              el.scrollIntoView?.({ block: "nearest" });
          }}
          // Keeps the focus in the typed field
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(option.value)}
          className={cx(
            "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-field px-3 text-body text-ink hover:bg-fill",
            index === active && "bg-fill",
          )}
        >
          <span className="truncate">{option.label}</span>
          {option.value === value && (
            <span className="shrink-0 text-primary">
              <CheckIcon size={18} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
