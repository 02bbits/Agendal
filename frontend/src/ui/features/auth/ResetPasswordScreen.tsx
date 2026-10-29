import { useRef, useState, type FormEvent } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { Link } from "../shell/Link";
import type { Navigate } from "../shell/routes";
import { PasswordField } from "./PasswordField";
import { signUpErrors } from "./validation";

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
  const passwordError =
    failure.password ?? (touched && rule ? t(rule) : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rule || busy || offline) return;
    setBusy(true);
    const result = await onSubmit(password);
    setBusy(false);
    setFailure(result ?? {});
    if (result?.password) passwordRef.current?.focus();
  }

  return (
    <form className="flex flex-col gap-5 pt-12" onSubmit={submit} noValidate>
      <h1 className="m-0 font-serif text-display font-semibold text-ink">
        {t("auth.new_password_title")}
      </h1>
      {expired ? (
        <>
          <p role="alert" className="m-0 text-body text-ink">
            {t("auth.reset_expired")}
          </p>
          <Link
            href={forgotPasswordHref}
            navigate={navigate}
            className="focus-ring self-start text-callout text-primary"
          >
            {t("auth.reset_request_new")}
          </Link>
        </>
      ) : (
        <>
          <PasswordField
            ref={passwordRef}
            label={t("auth.new_password")}
            autoComplete="new-password"
            value={password}
            helper={passwordError ? undefined : t("auth.password_rule")}
            error={passwordError}
            onChange={(event) => {
              setPassword(event.target.value);
              setFailure({});
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
        </>
      )}
    </form>
  );
}
