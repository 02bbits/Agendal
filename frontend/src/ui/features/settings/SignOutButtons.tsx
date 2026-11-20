import { useState, type ReactElement } from "react";
import { cx } from "../../components/cx";
import { LogOutIcon } from "../../components/icons";
import { t } from "../../copy";
import { SignOutDialog } from "../shell/SignOutDialog";
import { ROW_PRESS, SettingsCard } from "./SettingsRow";

/**
 * Settings' one Sign out button, with the sign-out icon (#168): a card at the end of a phone's
 * Settings list, or the foot of the desktop tab menu. It asks first; Sign out on all devices is a
 * choice in that dialog.
 */
export function SignOutButtons({
  variant,
  onSignOut,
  onSignOutEverywhere,
}: {
  variant: "phone" | "desktop";
  onSignOut: () => void;
  onSignOutEverywhere?: () => void;
}): ReactElement {
  const [asking, setAsking] = useState(false);
  const dialog = (
    <SignOutDialog
      open={asking}
      onSignOut={onSignOut}
      onSignOutEverywhere={onSignOutEverywhere}
      onClose={() => setAsking(false)}
    />
  );

  if (variant === "desktop")
    return (
      <div className="flex flex-col gap-0.5 border-t border-separator/40 pt-2">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="focus-ring flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-footnote text-error transition-colors hover:bg-fill/40"
        >
          <LogOutIcon size={17} aria-hidden="true" />
          <span className="truncate">{t("app.sign_out")}</span>
        </button>
        {dialog}
      </div>
    );

  return (
    <SettingsCard className="mt-6">
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={cx(
          "focus-ring flex min-h-[52px] w-full items-center justify-center gap-2 text-body font-semibold text-error",
          ROW_PRESS,
        )}
      >
        <LogOutIcon size={18} aria-hidden="true" />
        {t("app.sign_out")}
      </button>
      {dialog}
    </SettingsCard>
  );
}
