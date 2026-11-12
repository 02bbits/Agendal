import { useEffect, useRef, useState } from "react";
import CodeSlots, { type CodeSlotsStatus } from "../../components/CodeSlots";
import { cx } from "../../components/cx";
import { t } from "../../copy";
import { AuthLayout } from "./AuthLayout";
import { ROUTES, type Navigate } from "../shell/routes";

export interface VerifyResult {
  ok: boolean;
  status?: number;
  message?: string;
  user?: unknown;
}

export interface ResendResult {
  ok: boolean;
  status?: number;
  retryAfter?: number;
  message?: string;
}

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
  const [status, setStatus] = useState<CodeSlotsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const handleComplete = async (code: string) => {
    setErrorMessage(null);
    setResendSuccess(false);

    try {
      const res = onVerify
        ? await onVerify(code)
        : { ok: false, status: 500, message: t("error.generic") };

      if (!isMounted.current) return;

      if (res.ok) {
        setStatus("success");
        setTimeout(() => {
          navigate?.(ROUTES.welcome);
        }, 700);
      } else if (res.status === 422) {
        setStatus("error");
        setErrorMessage(res.message ?? t("auth.verify_wrong"));
      } else {
        setStatus("idle");
        setErrorMessage(res.message ?? t("error.generic"));
      }
    } catch {
      if (!isMounted.current) return;
      setStatus("idle");
      setErrorMessage(t("error.generic"));
    }
  };

  // The slots empty themselves after the error shake: the message stays until the user types
  const handleChange = (code: string) => {
    if (status === "error") setStatus("idle");
    if (code !== "") setErrorMessage(null);
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setErrorMessage(null);
    setResendSuccess(false);

    try {
      const res = onResend ? await onResend() : { ok: true };
      if (!isMounted.current) return;

      if (res.ok) {
        setResendSuccess(true);
        setSecondsLeft(45);
      } else if (res.status === 429) {
        const retryAfter = res.retryAfter ?? 45;
        setSecondsLeft(retryAfter);
        if (res.message) setErrorMessage(res.message);
      } else if (res.message) {
        setErrorMessage(res.message);
      }
    } catch {
      if (!isMounted.current) return;
      setErrorMessage(t("error.generic"));
    } finally {
      if (isMounted.current) {
        setResending(false);
      }
    }
  };

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

      <div className="mt-7 flex justify-center">
        <CodeSlots
          autoFocus
          slotSize={48}
          status={status}
          onComplete={handleComplete}
          onChange={handleChange}
        />
      </div>

      {errorMessage ? (
        <p role="alert" className="mt-3 text-center text-footnote text-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col items-center">
        <button
          type="button"
          disabled={secondsLeft > 0 || resending}
          onClick={handleResend}
          className="focus-ring inline-flex min-h-11 cursor-pointer items-center px-2 text-footnote font-semibold text-primary disabled:cursor-not-allowed disabled:font-normal disabled:text-ink-tertiary"
        >
          {secondsLeft > 0
            ? t("auth.verify_resend_in", { seconds: secondsLeft })
            : t("auth.verify_resend")}
        </button>
        {resendSuccess ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-2 text-center text-footnote text-ink-secondary"
          >
            {t("auth.verify_sent")}
          </p>
        ) : null}
      </div>

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
