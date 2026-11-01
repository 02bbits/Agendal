import type { ReactElement } from "react";
import { Button } from "@/ui";

/** A whole-page message with one action: not found with Back, an error with Retry. */
export function PageMessage({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}): ReactElement {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-body text-ink-secondary">{message}</p>
      <Button variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
