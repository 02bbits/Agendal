import { cx } from "../../components/cx";
import { t } from "../../copy";
import { AuthLayout } from "./AuthLayout";
import {
  CodeEntry,
  type CodeCheckResult,
  type CodeResendResult,
} from "./CodeEntry";
import { ROUTES, type Navigate } from "../shell/routes";

export type VerifyResult = CodeCheckResult;
export type ResendResult = CodeResendResult;

export interface VerifyEmailScreenProps {
  email?: string;
  onVerify?(code: string): Promise<VerifyResult>;
  onResend?(): Promise<ResendResult>;
  onSwitchAccount?(): void | Promise<void>;
  navigate?: Navigate;
}

export function VerifyEmailScreen({
  email = "",
  onVerify,
  onResend,
  onSwitchAccount,
  navigate,
}: VerifyEmailScreenProps) {
  const handleSwitchAccount = async () => {
    try {
      await onSwitchAccount?.();
    } finally {
      navigate?.(ROUTES.createAccount);
    }
  };

  // Until the account loads there is no address yet: keep the line's space, show no placeholder
  const emailText = email || "";
  const marker = "\u0000";
  const parts = t("auth.verify_body", { email: marker }).split(marker);

  return (
    <AuthLayout framed={true}>
      <div className="text-center lg:text-left mt-6 lg:mt-0">
        <h1 className="m-0 text-[22px] leading-[28px] font-bold tracking-[-0.015em] text-ink">
          {t("auth.verify_title")}
        </h1>
        <p
          className={cx(
            "m-0 mt-1 text-footnote text-ink-secondary",
            !emailText && "invisible",
          )}
        >
          {parts[0]}
          <span className="font-semibold text-ink">{emailText}</span>
          {parts[1]}
        </p>
      </div>

      <CodeEntry
        onCheck={onVerify}
        onResend={onResend}
        onVerified={() => navigate?.(ROUTES.welcome)}
      />

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={handleSwitchAccount}
          className="focus-ring inline-flex min-h-11 cursor-pointer items-center px-2 text-footnote text-ink-secondary"
        >
          <span className="link-swipe leading-4">
            {t("auth.verify_switch")}
          </span>
        </button>
      </div>
    </AuthLayout>
  );
}
