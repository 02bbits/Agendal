import { useRef, useState, type FormEvent } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { LockIcon } from "../../components/icons";
import { Link } from "../shell/Link";
import type { Navigate } from "../shell/routes";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "./PasswordField";
import { hasAccentedLetters, signUpErrors } from "./validation";

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
  navigate?: Navigate;
  offline?: boolean;
}

/** Set a new password from the emailed link (AA-4, AA §2.3 step 3). Same rules as sign-up. */
export function ResetPasswordScreen({
  email,
  onSubmit,
  forgotPasswordHref,
  navigate,
  offline = false,
}: ResetPasswordScreenProps) {
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<ResetFailure>({});
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const rule = signUpErrors(email ?? "", password).password;
  const expired = email === null || failure.expired;
  // Set when the form is sent with accented letters (Vietnamese typing), cleared on edit
  const [accentError, setAccentError] = useState(false);
  const passwordError =
    failure.password ??
    (accentError ? t("auth.password_accented") : undefined) ??
    (touched && rule ? t(rule) : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rule || busy || offline) return;
    if (hasAccentedLetters(password)) {
      setAccentError(true);
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    const result = await onSubmit(password);
    setBusy(false);
    setFailure(result ?? {});
    if (result?.password) passwordRef.current?.focus();
  }

  return (
    <AuthLayout>
      <div className="text-center lg:text-left mt-6 lg:mt-0">
        <h1 className="m-0 text-[22px] leading-[28px] font-bold tracking-[-0.015em] text-ink">
          {t("auth.new_password_title")}
        </h1>
        {!expired && email && (
          <p className="m-0 mt-1 text-footnote text-ink-secondary">
            {t("auth.new_password_for", { email })}
          </p>
        )}
      </div>
      {expired ? (
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
          {(failure.form || offline) && (
            <p role="alert" className="m-0 text-footnote text-error">
              {offline ? t("auth.offline") : failure.form}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            fullWidth
            busy={busy}
            disabled={Boolean(rule) || offline}
          >
            {t("auth.new_password_save")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
