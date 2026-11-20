import type { ReactElement } from "react";
import { t } from "../copy";
import { cx } from "./cx";
import { CheckIcon } from "./icons";

export interface LoadingScreenProps {
  /** While false it fades out; the caller unmounts it once the fade is over. */
  visible?: boolean;
  /**
   * In a tab's content area on a phone, under the header, with the tab bar still there: a tab
   * opened for the first time: only the spinner, no logo or name. Without it, the whole screen as
   * the app starts.
   */
  inline?: boolean;
  className?: string;
}

/**
 * The loading screen as the app starts (#161): the theme's plain background, the app logo in the
 * middle and a spinner under it. It says "Loading" to screen readers and keeps the spinner still
 * when the user asks for reduced motion.
 */
export function LoadingScreen({
  visible = true,
  inline = false,
  className,
}: LoadingScreenProps): ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("app.loading")}
      data-testid={inline ? "tab-loading" : "loading-screen"}
      data-state={visible ? "visible" : "hiding"}
      className={cx(
        "flex flex-col items-center justify-center gap-6 bg-paper transition-opacity duration-150 motion-reduce:transition-none",
        inline ? "min-h-[55dvh] w-full" : "fixed inset-0 z-[60]",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      {/* The logo and name only on the full screen as the app starts; inside the app, a spinner */}
      {!inline && (
        <div className="flex items-center gap-3 text-title font-bold text-ink">
          <span
            className="inline-flex size-12 items-center justify-center rounded-box bg-neutral text-neutral-content shadow-sm"
            aria-hidden="true"
          >
            <CheckIcon size={26} strokeWidth={2.25} />
          </span>
          <span aria-hidden="true">{t("app.name")}</span>
        </div>
      )}
      <span
        aria-hidden="true"
        className="loading loading-spinner loading-md text-ink-secondary motion-reduce:animate-none"
      />
    </div>
  );
}
