import { useRef, useState, type FormEvent } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { Link } from "../shell/Link";
import type { Navigate } from "../shell/routes";
import { normalizeEmail, signUpErrors } from "./validation";

export interface SignUpFailure {
  /** Server messages per field, already in copy-catalog text. */
  fields?: { email?: string; password?: string };
  /** Shown above the button, e.g. rate limited. */
  form?: string;
}

export interface CreateAccountScreenProps {
  /** Resolves with nothing on success; the caller moves on to Inbox. */
  onSubmit(values: {
    email: string;
    password: string;
  }): Promise<SignUpFailure | void>;
  signInHref: string;
  navigate?: Navigate;
  offline?: boolean;
}

/** Create account (AA-1, AA §2.1). Errors show after blur or submit (UX-07). */
export function CreateAccountScreen({
  onSubmit,
  signInHref,
  navigate,
  offline = false,
}: CreateAccountScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [server, setServer] = useState<SignUpFailure>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const local = signUpErrors(email, password);
  const valid = !local.email && !local.password;
  const emailError =
    server.fields?.email ??
    (touched.email && local.email ? t(local.email) : undefined);
  const passwordError =
    server.fields?.password ??
    (touched.password && local.password ? t(local.password) : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy || offline) return;
    setBusy(true);
    const failure = await onSubmit({ email: normalizeEmail(email), password });
    setBusy(false);
    if (!failure) return;
    setServer(failure);
    // A11Y-62: focus the first invalid field
    if (failure.fields?.email) emailRef.current?.focus();
    else if (failure.fields?.password) passwordRef.current?.focus();
  }

  return (
    <form className="flex flex-col gap-5 pt-12" onSubmit={submit} noValidate>
      <h1 className="m-0 font-serif text-display font-semibold text-ink">
        {t("auth.create_title")}
      </h1>
      <TextField
        ref={emailRef}
        label={t("auth.email")}
        type="email"
        autoComplete="email"
        value={email}
        error={emailError}
        onChange={(event) => {
          setEmail(event.target.value);
          setServer({});
        }}
        onBlur={() => setTouched((current) => ({ ...current, email: true }))}
      />
      {server.fields?.email && (
        <Link
          href={signInHref}
          navigate={navigate}
          className="focus-ring -mt-3 self-start text-footnote text-primary"
        >
          {t("auth.sign_in")}
        </Link>
      )}
      <div className="flex flex-col gap-1">
        <TextField
          ref={passwordRef}
          label={t("auth.password")}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          helper={passwordError ? undefined : t("auth.password_rule")}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
            setServer({});
          }}
          onBlur={() =>
            setTouched((current) => ({ ...current, password: true }))
          }
        />
        <button
          type="button"
          className="focus-ring min-h-11 self-end px-2 text-footnote text-primary"
          aria-pressed={showPassword}
          onClick={() => setShowPassword((shown) => !shown)}
        >
          {t("auth.show_password")}
        </button>
      </div>
      {(server.form || offline) && (
        <p role="alert" className="m-0 text-footnote text-error">
          {offline ? t("auth.offline") : server.form}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        fullWidth
        busy={busy}
        disabled={!valid || offline}
      >
        {t("auth.create_button")}
      </Button>
      <p className="m-0 text-center text-footnote text-ink-secondary">
        {t("auth.have_account")}{" "}
        <Link
          href={signInHref}
          navigate={navigate}
          className="focus-ring text-primary"
        >
          {t("auth.sign_in")}
        </Link>
      </p>
    </form>
  );
}
