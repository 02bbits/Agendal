import { t } from "../../copy";
import { Button } from "../../components/Button";
import { ArrowDownIcon, ShareIcon } from "../../components/icons";

export interface InstallBannerProps {
  /** prompt: the browser's own install (Chromium). ios / firefox: manual steps (AP-E1). */
  kind: "prompt" | "ios" | "firefox";
  onInstall: () => void;
  onNotNow: () => void;
}

/** Install banner on Inbox, once per device after the first sign-in (AP-1). Doesn't take focus. */
export function InstallBanner({
  kind,
  onInstall,
  onNotNow,
}: InstallBannerProps) {
  const Icon = kind === "ios" ? ShareIcon : ArrowDownIcon;
  return (
    <div
      role="status"
      className="mt-3 flex flex-wrap items-center gap-3 rounded-field border border-separator bg-surface-elevated px-4 py-3"
    >
      <Icon size={17} className="shrink-0 text-ink-secondary" />
      <p className="m-0 min-w-0 flex-1 text-callout text-ink">
        <span className="font-semibold">{t("app.install_title")}</span>
        {kind !== "prompt" && (
          <>
            {" "}
            <span className="text-ink-secondary">
              {t(kind === "ios" ? "app.install_ios" : "app.install_firefox")}
            </span>
          </>
        )}
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onNotNow}>
          {t("common.not_now")}
        </Button>
        {kind === "prompt" && (
          <Button size="sm" variant="primary" onClick={onInstall}>
            {t("app.install")}
          </Button>
        )}
      </div>
    </div>
  );
}
