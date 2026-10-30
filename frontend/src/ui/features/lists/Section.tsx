import { useId, useState, type ReactNode } from "react";
import { tc } from "../../copy";
import { cx } from "../../components/cx";
import { ChevronRightIcon } from "../../components/icons";

export interface SectionProps {
  title: string;
  count: number;
  /** Overdue: the heading is red, with the word and count so colour isn't the only signal (T-LV-03). */
  tone?: "danger";
  /** Collapsed sections are disclosure buttons with aria-expanded (A11Y-53). */
  collapsible?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/** A list section: heading with its count ("Overdue, 2 tasks" to screen readers, A11Y-50), then the list. */
export function Section({
  title,
  count,
  tone,
  collapsible = false,
  icon,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(!collapsible);
  const listId = useId();
  const label = tc("list.section_count", count, { section: title });
  const visible = (
    <span
      aria-hidden="true"
      className="inline-flex flex-1 items-center gap-1.5"
    >
      {icon}
      <span className={cx(tone === "danger" && "text-error")}>{title}</span>
      <span className="font-normal text-ink-tertiary">{count}</span>
    </span>
  );

  return (
    <section className="mb-6 [&>h2]:mt-0 [&>h2]:mb-1">
      <h2 className="mt-6 mb-2 flex items-baseline gap-1.5 text-heading font-semibold">
        {collapsible ? (
          <button
            type="button"
            className="focus-ring flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-tile border-0 border-t border-separator bg-transparent p-0 text-left text-ink"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
          >
            {visible}
            <span className="sr-only">{label}</span>
            <ChevronRightIcon
              size={18}
              className={cx(
                "text-ink-tertiary transition-transform duration-[180ms] motion-reduce:transition-none",
                open && "rotate-90",
              )}
            />
          </button>
        ) : (
          <>
            {visible}
            <span className="sr-only">{label}</span>
          </>
        )}
      </h2>
      <div id={listId} hidden={!open}>
        <ul className="m-0 list-none p-0">{children}</ul>
      </div>
    </section>
  );
}
