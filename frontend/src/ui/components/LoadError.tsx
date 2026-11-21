import type { ReactElement } from "react";
import { t } from "../copy";
import { Button } from "./Button";

/** A list that didn't load: the reason and Retry, under the page's own header and filters. */
export function LoadError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <p className="text-callout text-ink-secondary">
        {message || t("error.generic")}
      </p>
      <Button onClick={onRetry}>{t("common.retry")}</Button>
    </div>
  );
}
