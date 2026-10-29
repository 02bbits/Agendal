import { useState, type FormEvent } from "react";
import { now } from "../../../lib/clock";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { Link } from "../shell/Link";
import type { Navigate } from "../shell/routes";
import { isEmail, normalizeEmail } from "./validation";
import { useSecondsLeft } from "./useSecondsLeft";

/** Resend unlocks 45 s after each send (AA-4). */
export const RESEND_AFTER_MS = 45_000;

export interface ForgotPasswordScreenProps {
  /** Resolves with nothing once sent, or with a message to show (rate limited, offline). */
  onSubmit(email: string): Promise<string | void>;
  signInHref: string;
  navigate?: Navigate;
  offline?: boolean;
}

/** Reset request (AA-4, AA §2.3 step 1). The same confirmation shows for any email. */
export function ForgotPasswordScreen({
  onSubmit,
  signInHref,
  navigate,
  offline = false,
}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const wait = useSecondsLeft(resendAt);

  async function send(address: string) {
    setBusy(true);
    const failure = await onSubmit(address);
    setBusy(false);
    setError(failure ?? undefined);
    if (failure) return;
    setSentTo(address);
    setResendAt(now().getTime() + RESEND_AFTER_MS);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isEmail(email) && !busy && !offline) void send(normalizeEmail(email));
  }

  return (
    <div className="flex flex-col gap-5 pt-12">
      <h1 className="m-0 font-serif text-display font-semibold text-ink">
        {t("auth.reset_title")}
      </h1>
      {sentTo ? (
        <>
          <p role="status" className="m-0 text-body text-ink">
            {t("auth.reset_sent", { email: sentTo })}
          </p>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            busy={busy}
            disabled={wait > 0 || offline}
            onClick={() => void send(sentTo)}
          >
            {wait > 0
              ? t("auth.reset_resend_in", { seconds: wait })
              : t("auth.reset_resend")}
          </Button>
        </>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
          <TextField
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button
            type="submit"
            size="lg"
            fullWidth
            busy={busy}
            disabled={!isEmail(email) || offline}
          >
            {t("auth.reset_send")}
          </Button>
        </form>
      )}
      {(error || offline) && (
        <p role="alert" className="m-0 text-footnote text-error">
          {offline ? t("auth.offline") : error}
        </p>
      )}
      <Link
        href={signInHref}
        navigate={navigate}
        className="focus-ring self-center text-footnote text-primary"
      >
        {t("auth.back_to_sign_in")}
      </Link>
    </div>
  );
}
