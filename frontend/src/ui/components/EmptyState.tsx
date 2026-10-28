import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: ReactNode;
  /** e.g. a link to Upcoming from the Inbox empty state. */
  action?: ReactNode;
  /** Heading level that fits the screen's outline. */
  headingLevel?: 2 | 3;
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  headingLevel = 2,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="flex flex-col items-center gap-2 px-5 py-8 text-center">
      {icon && (
        <span className="text-ink-tertiary" aria-hidden="true">
          {icon}
        </span>
      )}
      <Heading className="m-0 font-serif text-dialog font-semibold text-balance focus:outline-none">
        {title}
      </Heading>
      {body && (
        <p className="m-0 max-w-[300px] text-callout text-ink-secondary">
          {body}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </section>
  );
}
