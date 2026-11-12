import { t } from "../../copy";
import { CloudIcon } from "../../components/icons";

/** "You're offline" on the list screens (AP-2, UX-40). Nothing turns read-only. */
export function OfflineBanner() {
  return (
    <div
      role="status"
      className="mt-3 flex items-start gap-3 rounded-field border border-separator bg-surface-elevated px-4 py-3"
    >
      <CloudIcon size={17} className="mt-0.5 shrink-0 text-ink-secondary" />
      <p className="m-0 text-callout text-ink">
        <span className="font-semibold">{t("app.offline")}</span>{" "}
        <span className="text-ink-secondary">{t("app.offline_body")}</span>
      </p>
    </div>
  );
}
