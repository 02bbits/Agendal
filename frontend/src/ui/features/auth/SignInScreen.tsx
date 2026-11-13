import { useEffect, useRef, useState, type FormEvent } from "react";
import CodeSlots, { type CodeSlotsStatus } from "../../components/CodeSlots";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { LockIcon, MailIcon } from "../../components/icons";
import { t } from "../../copy";
import { Link } from "../shell/Link";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "./PasswordField";
import { useSecondsLeft } from "./useSecondsLeft";
import type { Navigate } from "../shell/routes";
import { hasAccentedLetters, normalizeEmail } from "./validation";
import type { ResendResult, VerifyResult } from "./VerifyEmailScreen";

export interface SignInFailure {
  /** Wrong email or password (auth.invalid). */
  invalid?: boolean;
  /** Any other message, e.g. offline or a server error. */
  form?: string;
}

export interface TwoFactorState {
  twoFactor: true;
  email: string;
}

export interface TwoFactorChallengeResult extends VerifyResult {
  code?: string;
}

export type SignInResult = SignInFailure | TwoFactorState | void;

export interface SignInScreenProps {
  /** Resolves with nothing on success or lockout; returns { twoFactor: true, email } on 2FA challenge. */
  onSubmit(values: {
    email: string;
    password: string;
    remember: boolean;
  }): Promise<SignInResult>;
  /** When the lockout ends (epoch ms). Sign in stays disabled until then (AA-3). */
  lockedUntil?: number | null;
  forgotPasswordHref: string;
  createAccountHref: string;
  navigate?: Navigate;
  offline?: boolean;
  onTwoFactorChallenge?(code: string): Promise<TwoFactorChallengeResult>;
  onTwoFactorResend?(): Promise<ResendResult>;
  onTwoFactorSuccess?(user: unknown): void;
}

/** Sign in (AA-2, AA-3, AA §2.2) and Two-step verification (issue #149). */
export function SignInScreen({
  onSubmit,
  lockedUntil,
  forgotPasswordHref,
  createAccountHref,
  navigate,
  offline = false,
  onTwoFactorChallenge,
  onTwoFactorResend,
  onTwoFactorSuccess,
}: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [failure, setFailure] = useState<SignInFailure>({});
  const [invalidWithAccents, setInvalidWithAccents] = useState(false);
  const [busy, setBusy] = useState(false);

  // Two-factor state
  const [twoFactorData, setTwoFactorData] = useState<{ email: string } | null>(
    null,
  );
  const [twoFactorStatus, setTwoFactorStatus] =
    useState<CodeSlotsStatus>("idle");
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resending, setResending] = useState(false);

  // Live countdown from the server's retry_after (AA-3, T-AA-103)
  const locked = useSecondsLeft(lockedUntil);
  const passwordRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!twoFactorData || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [twoFactorData, secondsLeft]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password || busy || offline || locked > 0) return;
    // Sent as typed (an older password may have accents); a wrong one then gets the hint (AA §2.10)
    const typedAccents = hasAccentedLetters(password);
    setBusy(true);
    const result = await onSubmit({
      email: normalizeEmail(email),
      password,
      remember,
    });
    setBusy(false);

    if (result && "twoFactor" in result && result.twoFactor) {
      setTwoFactorData({ email: result.email });
      setFailure({});
      setTwoFactorStatus("idle");
      setTwoFactorError(null);
      setSecondsLeft(45);
      setResendSuccess(false);
      return;
    }

    const fail = (result as SignInFailure) ?? {};
    setFailure(fail);
    setInvalidWithAccents(Boolean(fail.invalid) && typedAccents);
    if (fail.invalid) {
      // AA §2.2: keep the email, clear and focus the password
      setPassword("");
      passwordRef.current?.focus();
    }
  }

  const handleTwoFactorComplete = async (code: string) => {
    setTwoFactorError(null);
    setResendSuccess(false);

    try {
      const res = onTwoFactorChallenge
        ? await onTwoFactorChallenge(code)
        : { ok: false, status: 500, message: t("error.generic") };

      if (!isMounted.current) return;

      if (res.code === "auth.two_factor_expired") {
        setTwoFactorData(null);
        setPassword("");
        setFailure({ form: res.message ?? t("auth.two_factor_expired") });
        return;
      }

      if (res.ok) {
        setTwoFactorStatus("success");
        setTimeout(() => {
          if (!isMounted.current) return;
          if (onTwoFactorSuccess) {
            onTwoFactorSuccess(res.user);
          } else {
            navigate?.("/");
          }
        }, 700);
      } else if (res.status === 422) {
        setTwoFactorStatus("error");
        setTwoFactorError(res.message ?? t("auth.verify_wrong"));
      } else {
        setTwoFactorStatus("idle");
        setTwoFactorError(res.message ?? t("error.generic"));
      }
    } catch {
      if (!isMounted.current) return;
      setTwoFactorStatus("idle");
      setTwoFactorError(t("error.generic"));
    }
  };

  const handleTwoFactorChange = (code: string) => {
    if (twoFactorStatus === "error") setTwoFactorStatus("idle");
    if (code !== "") setTwoFactorError(null);
  };

  const handleTwoFactorResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setTwoFactorError(null);
    setResendSuccess(false);

    try {
      const res = onTwoFactorResend ? await onTwoFactorResend() : { ok: true };
      if (!isMounted.current) return;

      if (res.ok) {
        setResendSuccess(true);
        setSecondsLeft(45);
      } else if (res.status === 429) {
        const retryAfter = res.retryAfter ?? 45;
        setSecondsLeft(retryAfter);
        if (res.message) setTwoFactorError(res.message);
      } else if (res.message) {
        setTwoFactorError(res.message);
      }
    } catch {
      if (!isMounted.current) return;
      setTwoFactorError(t("error.generic"));
    } finally {
      if (isMounted.current) {
        setResending(false);
      }
    }
  };

  const handleBackToPassword = () => {
    setTwoFactorData(null);
    setPassword("");
    setTwoFactorError(null);
    passwordRef.current?.focus();
  };

  const message = offline
    ? t("auth.offline")
    : failure.invalid
      ? t(invalidWithAccents ? "auth.invalid_accented" : "auth.invalid")
      : failure.form;

  // Split masked body for 2FA
  const marker = "\u0000";
  const twoFactorParts = t("auth.two_factor_body", { email: marker }).split(
    marker,
  );

  return (
    <AuthLayout transitionKey={twoFactorData ? "two-factor" : "password"}>
      {twoFactorData ? (
        <>
          <div className="text-center lg:text-left mt-6 lg:mt-0">
            <h1 className="m-0 text-[22px] leading-[28px] font-bold tracking-[-0.015em] text-ink">
              {t("auth.two_factor_title")}
            </h1>
            <p className="m-0 mt-1 text-footnote text-ink-secondary">
              {twoFactorParts[0]}
              <span className="font-semibold text-ink">
                {twoFactorData.email}
              </span>
              {twoFactorParts[1]}
            </p>
          </div>

          <div className="mt-7 flex justify-center">
            <CodeSlots
              autoFocus
              slotSize={48}
              status={twoFactorStatus}
              onComplete={handleTwoFactorComplete}
              onChange={handleTwoFactorChange}
            />
          </div>

          {twoFactorError ? (
            <p
              role="alert"
              className="mt-3 text-center text-footnote text-error"
            >
              {twoFactorError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col items-center">
            <button
              type="button"
              disabled={secondsLeft > 0 || resending}
              onClick={handleTwoFactorResend}
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
              onClick={handleBackToPassword}
              className="focus-ring inline-flex min-h-11 cursor-pointer items-center px-2 text-footnote text-ink-secondary"
            >
              <span className="link-swipe leading-4">
                {t("auth.two_factor_back")}
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center lg:text-left mt-6 lg:mt-0">
            <h1 className="m-0 text-[22px] leading-[28px] font-bold tracking-[-0.015em] text-ink">
              {t("auth.sign_in_title")}
            </h1>
            <p className="m-0 mt-1 text-footnote text-ink-secondary">
              {t("auth.sign_in_subtitle")}
            </p>
          </div>
          <form
            className="mt-7 lg:mt-6 flex flex-col gap-3.5"
            onSubmit={submit}
            noValidate
          >
            {locked > 0 && (
              <div className="rounded-field bg-danger-tint p-4 text-callout text-error">
                {/* Announced once; the countdown below isn't read out every second (A11Y-61) */}
                <p role="alert" className="m-0 font-semibold">
                  {t("auth.locked_title")}
                </p>
                <p className="m-0">
                  {t("auth.locked_body", { seconds: locked })}
                </p>
              </div>
            )}
            <p role="status" className="sr-only">
              {lockedUntil && locked === 0 ? t("auth.unlocked") : ""}
            </p>
            <TextField
              label={t("auth.email")}
              type="email"
              autoComplete="email"
              value={email}
              leading={<MailIcon size={18} />}
              onChange={(event) => setEmail(event.target.value)}
            />
            <PasswordField
              ref={passwordRef}
              label={t("auth.password")}
              autoComplete="current-password"
              value={password}
              leading={<LockIcon size={18} />}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="flex min-h-11 items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-footnote text-ink">
                <input
                  type="checkbox"
                  className="size-[18px] rounded accent-primary focus-ring cursor-pointer"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                {t("auth.remember_me")}
              </label>
              <Link
                href={forgotPasswordHref}
                navigate={navigate}
                className="focus-ring inline-flex min-h-11 items-center text-footnote text-primary"
              >
                <span className="link-swipe leading-4">
                  {t("auth.forgot_password")}
                </span>
              </Link>
            </div>
            {message && (
              <p role="alert" className="m-0 text-footnote text-error">
                {message}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              fullWidth
              busy={busy}
              disabled={!email || !password || offline || locked > 0}
            >
              {t("auth.sign_in")}
            </Button>
            <p className="m-0 text-center text-footnote text-ink-secondary">
              {t("auth.no_account")}{" "}
              <Link
                href={createAccountHref}
                navigate={navigate}
                className="focus-ring text-primary link-swipe"
              >
                {t("auth.create_title")}
              </Link>
            </p>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
