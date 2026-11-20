import type { ReactElement } from "react";
import { cx } from "../../components/cx";
import { LogOutIcon } from "../../components/icons";
import { t } from "../../copy";
import { ROW_PRESS, SettingsCard } from "./SettingsRow";

/**
 * Sign out, and Sign out on all devices while the app offers it, each with the sign-out icon
 * (#168): rows in their own card at the end of a phone's Settings list, or at the foot of the
 * desktop tab menu.
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
  const actions = [
    { label: t("app.sign_out"), onClick: onSignOut },
    ...(onSignOutEverywhere
      ? [{ label: t("auth.signout_everywhere"), onClick: onSignOutEverywhere }]
      : []),
  ];

  if (variant === "desktop")
    return (
      <div className="flex flex-col gap-0.5 border-t border-separator/40 pt-2">
        {actions.map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="focus-ring flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-footnote text-error transition-colors hover:bg-fill/40"
          >
            <LogOutIcon size={17} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    );

  return (
    <SettingsCard className="mt-6">
      {actions.map(({ label, onClick }, index) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
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
    </SettingsCard>
  );
}
