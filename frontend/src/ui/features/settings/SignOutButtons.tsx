import { useState, type ReactElement } from "react";
import { cx } from "../../components/cx";
import { LogOutIcon } from "../../components/icons";
import { t } from "../../copy";
import { SignOutDialog, type SignOutChoice } from "../shell/SignOutDialog";
import { ROW_PRESS, SettingsCard } from "./SettingsRow";

/**
 * Sign out, and Sign out on all devices while the app offers it, each with the sign-out icon and
 * each asking first (#168): rows in their own card at the end of a phone's Settings list, or at the
 * foot of the desktop tab menu.
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
  const [asking, setAsking] = useState<SignOutChoice | null>(null);
  const actions: { label: string; choice: SignOutChoice }[] = [
    { label: t("app.sign_out"), choice: "this" },
    ...(onSignOutEverywhere
      ? [{ label: t("auth.signout_everywhere"), choice: "everywhere" as const }]
      : []),
  ];
  const dialog = (
    <SignOutDialog
      choice={asking}
      onSignOut={onSignOut}
      onSignOutEverywhere={onSignOutEverywhere}
      onClose={() => setAsking(null)}
    />
  );

  if (variant === "desktop")
    return (
      <div className="flex flex-col gap-0.5 border-t border-separator/40 pt-2">
        {actions.map(({ label, choice }) => (
          <button
            key={choice}
            type="button"
            onClick={() => setAsking(choice)}
            className="focus-ring flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-footnote text-error transition-colors hover:bg-fill/40"
          >
            <LogOutIcon size={17} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        ))}
        {dialog}
      </div>
    );

  return (
    <SettingsCard className="mt-6">
      {actions.map(({ label, choice }, index) => (
        <button
          key={choice}
          type="button"
          onClick={() => setAsking(choice)}
          className={cx(
            "focus-ring flex min-h-[52px] w-full items-center justify-center gap-2 text-body font-semibold text-error",
            index > 0 && "border-t border-separator",
            ROW_PRESS,
          )}
        >
          <LogOutIcon size={18} aria-hidden="true" />
          {label}
        </button>
      ))}
      {dialog}
    </SettingsCard>
  );
}
