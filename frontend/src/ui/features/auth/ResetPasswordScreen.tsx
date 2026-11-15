import { useRef, useState, type FormEvent } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { LockIcon } from "../../components/icons";
import { Link } from "../shell/Link";
import type { Navigate } from "../shell/routes";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "./PasswordField";
import { PasswordStrength } from "./PasswordStrength";
import { hasNonKeyboardCharacters, passwordRuleError } from "./validation";

export interface ResetFailure {
  /** The link expired or was already used (auth.reset_expired). */
  expired?: boolean;
  /** Server message for the password, e.g. breached. */
  password?: string;
  form?: string;
}

export interface ResetPasswordScreenProps {
  /** The email from the link; null when the link had no token. */
  email: string | null;
  onSubmit(password: string): Promise<ResetFailure | void>;
  forgotPasswordHref: string;
  /** Where Sign in goes once the password is saved: a reset signs nobody in (AA §2.3). */
  signInHref: string;
  navigate?: Navigate;
  offline?: boolean;
}

/** Set a new password from the emailed link (AA-4, AA §2.3 step 3). Same rules as sign-up. */
export function ResetPasswordScreen({
  email,
  onSubmit,
  forgotPasswordHref,
  signInHref,
  navigate,
  offline = false,
}: ResetPasswordScreenProps) {
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [failure, setFailure] = useState<ResetFailure>({});
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const rule = passwordRuleError(password, email ?? "");
  const expired = email === null || failure.expired;
  // Set when the form is sent with characters an English keyboard does not type (Vietnamese typing), cleared on edit
  const [accentError, setAccentError] = useState(false);
  const passwordError =
    failure.password ??
    (accentError ? t("auth.password_accented") : undefined) ??
    (touched && rule ? t(rule) : undefined);

  const confirmMismatch =
    confirmTouched && confirmPassword !== "" && password !== confirmPassword;
  const confirmError = confirmMismatch
    ? t("auth.password_mismatch")
    : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rule || busy || offline) return;
    if (password !== confirmPassword) {
      setConfirmTouched(true);
      confirmPasswordRef.current?.focus();
      return;
    }
    if (hasNonKeyboardCharacters(password)) {
      setAccentError(true);
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    const result = await onSubmit(password);
    setBusy(false);
    setFailure(result ?? {});
    if (!result) setDone(true);
    if (result?.password) passwordRef.current?.focus();
  }

  return (
    <AuthLayout>
      <div className="text-center lg:text-left mt-6 lg:mt-0">
        <h1 className="m-0 text-[22px] leading-[28px] font-bold tracking-[-0.015em] text-ink">
          {done ? t("auth.reset_done_title") : t("auth.new_password_title")}
        </h1>
        {!done && !expired && email && (
          <p className="m-0 mt-1 text-footnote text-ink-secondary">
            {t("auth.new_password_for", { email })}
          </p>
        )}
      </div>
      {done ? (
        <div className="mt-7 lg:mt-6 flex flex-col gap-3.5">
          <p role="status" className="m-0 text-body text-ink">
            {t("auth.reset_done_body")}
          </p>
          <Button
            size="lg"
            fullWidth
            autoFocus
            onClick={() => navigate?.(signInHref)}
          >
            {t("auth.sign_in")}
          </Button>
        </div>
      ) : expired ? (
        <div className="mt-7 lg:mt-6 flex flex-col gap-3.5">
          <p role="alert" className="m-0 text-body text-ink">
            {t("auth.reset_expired")}
          </p>
          <Link
            href={forgotPasswordHref}
            navigate={navigate}
            className="focus-ring self-center inline-flex min-h-11 items-center text-footnote text-primary"
          >
            <span className="link-swipe leading-4">
              {t("auth.reset_request_new")}
            </span>
          </Link>
        </div>
      ) : (
        <form
          className="mt-7 lg:mt-6 flex flex-col gap-3.5"
          onSubmit={submit}
          noValidate
        >
          {/* Lets a password manager save the new password to the right account */}
          <input
            type="email"
            autoComplete="username"
            value={email ?? ""}
            readOnly
            hidden
          />
          <PasswordField
            ref={passwordRef}
            label={t("auth.new_password")}
            autoComplete="new-password"
            value={password}
            leading={<LockIcon size={18} />}
            helper={passwordError ? undefined : t("auth.password_rule")}
            error={passwordError}
            onChange={(event) => {
              setPassword(event.target.value);
              setFailure({});
              setAccentError(false);
            }}
            onBlur={() => setTouched(true)}
          />
          <PasswordStrength id="reset-password-strength" password={password} />
          <PasswordField
            ref={confirmPasswordRef}
            label={t("settings.confirm_password")}
            autoComplete="new-password"
            value={confirmPassword}
            leading={<LockIcon size={18} />}
            error={confirmError}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFailure({});
            }}
            onBlur={() => setConfirmTouched(true)}
          />
          {(failure.form || offline) && (
            <p role="alert" className="m-0 text-footnote text-error">
              {offline ? t("auth.offline") : failure.form}
            </p>
          )}
          <Button
            type="submit"
            // Phones: a clear gap between the fields and the main button
            className="mt-3 lg:mt-0"
            size="lg"
            fullWidth
            busy={busy}
            disabled={
              Boolean(rule) ||
              !password ||
              !confirmPassword ||
              password !== confirmPassword ||
              offline
            }
          >
            {t("auth.new_password_save")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
