import { useRef, useState, type FormEvent } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { Link } from "../shell/Link";
import { PasswordField } from "./PasswordField";
import { useSecondsLeft } from "./useSecondsLeft";
import type { Navigate } from "../shell/routes";
import { normalizeEmail } from "./validation";

export interface SignInFailure {
  /** Wrong email or password (auth.invalid). */
  invalid?: boolean;
  /** Any other message, e.g. offline or a server error. */
  form?: string;
}

export interface SignInScreenProps {
  /** Resolves with nothing on success or lockout; the caller moves on or sets `lockedUntil`. */
  onSubmit(values: {
    email: string;
    password: string;
    remember: boolean;
  }): Promise<SignInFailure | void>;
  /** When the lockout ends (epoch ms). Sign in stays disabled until then (AA-3). */
  lockedUntil?: number | null;
  forgotPasswordHref: string;
  createAccountHref: string;
  navigate?: Navigate;
  offline?: boolean;
}

/** Sign in (AA-2, AA-3, AA §2.2). */
export function SignInScreen({
  onSubmit,
  lockedUntil,
  forgotPasswordHref,
  createAccountHref,
  navigate,
  offline = false,
}: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [failure, setFailure] = useState<SignInFailure>({});
  const [busy, setBusy] = useState(false);
  // Live countdown from the server's retry_after (AA-3, T-AA-103)
  const locked = useSecondsLeft(lockedUntil);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password || busy || offline || locked > 0) return;
    setBusy(true);
    const result = await onSubmit({
      email: normalizeEmail(email),
      password,
      remember,
    });
    setBusy(false);
    setFailure(result ?? {});
    if (result?.invalid) {
      // AA §2.2: keep the email, clear and focus the password
      setPassword("");
      passwordRef.current?.focus();
    }
  }

  const message = offline
    ? t("auth.offline")
    : failure.invalid
      ? t("auth.invalid")
      : failure.form;

  return (
    <form className="flex flex-col gap-5 pt-12" onSubmit={submit} noValidate>
      <h1 className="m-0 font-serif text-display font-semibold text-ink">
        {t("auth.sign_in")}
      </h1>
      {locked > 0 && (
        <div className="rounded-field bg-danger-tint p-4 text-callout text-error">
          {/* Announced once; the countdown below isn't read out every second (A11Y-61) */}
          <p role="alert" className="m-0 font-semibold">
            {t("auth.locked_title")}
          </p>
          <p className="m-0">{t("auth.locked_body", { seconds: locked })}</p>
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
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className="flex flex-col gap-1">
        <PasswordField
          ref={passwordRef}
          label={t("auth.password")}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Link
          href={forgotPasswordHref}
          navigate={navigate}
          className="focus-ring inline-flex min-h-11 items-center self-start px-1 text-footnote text-primary"
        >
          {t("auth.forgot_password")}
        </Link>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-callout text-ink">
        <input
          type="checkbox"
          className="checkbox checkbox-primary focus-ring"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        {t("auth.remember_me")}
      </label>
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
          className="focus-ring text-primary"
        >
          {t("auth.create_title")}
        </Link>
      </p>
    </form>
  );
}
