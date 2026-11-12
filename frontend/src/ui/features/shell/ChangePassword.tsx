import { useEffect, useRef, useState, type FormEvent } from "react";
import { t } from "../../copy";
import { Button } from "../../components/Button";
import { CheckIcon } from "../../components/icons";
import { cx } from "../../components/cx";
import { PasswordField } from "../auth/PasswordField";
import { passwordStrength } from "../../domain/passwordStrength";
import { api } from "../../../lib/api";

export interface ChangePasswordProps {
  email: string;
  onBack: () => void;
  showToast?: (message: string) => void;
}

export function ChangePassword({ email, onBack }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [currentError, setCurrentError] = useState<string | undefined>();
  const [newError, setNewError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const [currentStatus, setCurrentStatus] = useState<
    "unchecked" | "checking" | "verified"
  >("unchecked");
  const checkingRef = useRef(false);
  const lastCheckedValRef = useRef<string | null>(null);

  const currentRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (success) {
      successHeadingRef.current?.focus();
    }
  }, [success]);

  const hasNew = newPassword.length > 0;
  const len = [...newPassword].length;
  const ruleLength = hasNew && len >= 8 && len <= 128;
  const ruleNotEmail =
    hasNew && newPassword.toLowerCase() !== email.trim().toLowerCase();
  const hasCurrent = currentPassword.length > 0;
  const ruleNotCurrent =
    hasCurrent && hasNew && newPassword !== currentPassword;

  const allRulesPass = ruleLength && ruleNotEmail && ruleNotCurrent;

  const confirmHasValue = confirmPassword.length > 0;
  const confirmMatch = confirmHasValue && confirmPassword === newPassword;
  const confirmMismatch = confirmHasValue && confirmPassword !== newPassword;

  const canSave = hasCurrent && allRulesPass && confirmMatch && !busy;

  const score = passwordStrength(newPassword);
  const strengthWord =
    score === 1
      ? t("auth.strength_weak")
      : score === 2
        ? t("auth.strength_fair")
        : score === 3
          ? t("auth.strength_good")
          : score === 4
            ? t("auth.strength_strong")
            : undefined;

  async function handleCurrentBlur() {
    const val = currentPassword;
    if (
      !val ||
      checkingRef.current ||
      (currentStatus === "verified" && lastCheckedValRef.current === val)
    ) {
      return;
    }
    if (lastCheckedValRef.current === val && currentError) {
      return;
    }
    checkingRef.current = true;
    setCurrentStatus("checking");

    try {
      const response = await api("/auth/check-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: val }),
      });
      lastCheckedValRef.current = val;

      if (response.status === 204 || response.ok) {
        setCurrentStatus("verified");
        setCurrentError(undefined);
      } else if (response.status === 422) {
        setCurrentStatus("unchecked");
        setCurrentError(t("auth.current_password_wrong"));
      } else if (response.status === 429) {
        setCurrentStatus("unchecked");
        const data = await response.json().catch(() => null);
        const seconds =
          data?.error?.retry_after ??
          response.headers.get("Retry-After") ??
          "60";
        setCurrentError(t("error.rate_limited", { seconds: String(seconds) }));
      } else {
        setCurrentStatus("unchecked");
      }
    } catch {
      setCurrentStatus("unchecked");
    } finally {
      checkingRef.current = false;
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setBusy(true);
    setCurrentError(undefined);
    setNewError(undefined);
    setConfirmError(undefined);
    setFormError(undefined);

    let response: Response;
    try {
      response = await api("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      });
    } catch {
      setBusy(false);
      setFormError(t("auth.offline"));
      return;
    }

    setBusy(false);

    if (response.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
      return;
    }

    const data = await response.json().catch(() => null);

    if (response.status === 429) {
      const seconds =
        data?.error?.retry_after ?? response.headers.get("Retry-After") ?? "60";
      setFormError(t("error.rate_limited", { seconds: String(seconds) }));
      return;
    }

    if (response.status === 422) {
      if (data?.error?.fields?.current_password) {
        setCurrentError(t("auth.current_password_wrong"));
        currentRef.current?.focus();
        currentRef.current?.select();
      }
      if (data?.error?.fields?.password) {
        setNewError(data.error.fields.password[0]);
      }
      if (data?.error?.fields?.password_confirmation) {
        setConfirmError(data.error.fields.password_confirmation[0]);
      }
      return;
    }

    setFormError(
      t("error.generic", { request_id: data?.error?.request_id ?? "" }),
    );
  }

  if (success) {
    return (
      <div
        role="status"
        className="flex w-full flex-col items-center gap-3 py-10 text-center"
      >
        <div
          className="size-14 rounded-full bg-success-tint text-success flex items-center justify-center motion-safe:animate-scale-in"
          aria-hidden="true"
        >
          <CheckIcon size={28} />
        </div>
        <h2
          ref={successHeadingRef}
          tabIndex={-1}
          className="m-0 text-title-3 font-semibold text-ink caret-transparent outline-none"
        >
          {t("settings.password_changed_title")}
        </h2>
        <p className="m-0 max-w-[360px] text-footnote text-ink-secondary">
          {t("settings.password_changed_body", { email })}
        </p>
        <Button variant="primary" onClick={onBack}>
          {t("common.done")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 max-w-[420px]"
      noValidate
    >
      {formError && (
        <p role="alert" className="m-0 text-footnote text-error">
          {formError}
        </p>
      )}

      {/* Current password */}
      <div>
        <PasswordField
          ref={currentRef}
          label={t("settings.current_password")}
          autoComplete="current-password"
          value={currentPassword}
          error={currentError}
          onBlur={handleCurrentBlur}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setCurrentError(undefined);
            setFormError(undefined);
            setCurrentStatus("unchecked");
            lastCheckedValRef.current = null;
          }}
        />
      </div>

      {/* New password */}
      <div className="flex flex-col gap-2">
        <PasswordField
          label={t("settings.new_password")}
          autoComplete="new-password"
          value={newPassword}
          error={newError}
          aria-describedby="new-pw-rules new-pw-strength"
          onChange={(e) => {
            setNewPassword(e.target.value);
            setNewError(undefined);
            setFormError(undefined);
          }}
        />

        {/* Checklist */}
        <ul
          id="new-pw-rules"
          aria-live="polite"
          className="m-0 p-0 list-none flex flex-col gap-1 text-footnote text-ink-secondary"
        >
          <li className="flex items-center gap-2">
            <span
              className={cx(
                "size-3.5 inline-flex items-center justify-center rounded-full transition-all motion-safe:duration-150",
                ruleLength
                  ? "bg-success text-white motion-safe:scale-100 opacity-100"
                  : "border border-control opacity-70",
              )}
              aria-hidden="true"
            >
              {ruleLength && <CheckIcon size={10} strokeWidth={3} />}
            </span>
            <span className={cx(ruleLength && "text-ink font-medium")}>
              {t("auth.rule_length")}
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span
              className={cx(
                "size-3.5 inline-flex items-center justify-center rounded-full transition-all motion-safe:duration-150",
                ruleNotEmail
                  ? "bg-success text-white motion-safe:scale-100 opacity-100"
                  : "border border-control opacity-70",
              )}
              aria-hidden="true"
            >
              {ruleNotEmail && <CheckIcon size={10} strokeWidth={3} />}
            </span>
            <span className={cx(ruleNotEmail && "text-ink font-medium")}>
              {t("auth.rule_not_email")}
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span
              className={cx(
                "size-3.5 inline-flex items-center justify-center rounded-full transition-all motion-safe:duration-150",
                ruleNotCurrent
                  ? "bg-success text-white motion-safe:scale-100 opacity-100"
                  : "border border-control opacity-70",
              )}
              aria-hidden="true"
            >
              {ruleNotCurrent && <CheckIcon size={10} strokeWidth={3} />}
            </span>
            <span className={cx(ruleNotCurrent && "text-ink font-medium")}>
              {t("auth.rule_not_current")}
            </span>
          </li>
        </ul>

        {/* Strength bar */}
        <div
          id="new-pw-strength"
          aria-live="polite"
          className="flex flex-col gap-1 mt-1"
        >
          <div className="flex gap-1.5 h-1 w-full" aria-hidden="true">
            {[1, 2, 3, 4].map((seg) => (
              <div
                key={seg}
                className={cx(
                  "flex-1 h-full rounded-full transition-colors",
                  score >= seg
                    ? score === 1
                      ? "bg-error"
                      : score === 2
                        ? "bg-warning"
                        : score === 3
                          ? "bg-info"
                          : "bg-success"
                    : "bg-fill-2",
                )}
              />
            ))}
          </div>

          <div className="flex items-start gap-3 text-caption">
            {strengthWord && (
              <span className="shrink-0 whitespace-nowrap font-semibold text-ink">
                {strengthWord}
              </span>
            )}
            <span className="min-w-0 flex-1 text-ink-tertiary">
              {t("auth.strength_hint")}
            </span>
          </div>
        </div>
      </div>

      {/* Confirm password */}
      <div className="flex flex-col gap-1.5">
        <PasswordField
          label={t("settings.confirm_password")}
          autoComplete="new-password"
          value={confirmPassword}
          error={confirmError}
          aria-describedby="confirm-pw-feedback"
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setConfirmError(undefined);
            setFormError(undefined);
          }}
        />

        <div id="confirm-pw-feedback" aria-live="polite" className="min-h-5">
          {confirmMismatch && (
            <p className="m-0 text-footnote text-error">
              {t("auth.password_mismatch")}
            </p>
          )}
          {confirmMatch && (
            <p className="m-0 text-footnote text-success flex items-center gap-1.5 font-medium">
              <CheckIcon size={14} strokeWidth={2.5} />
              {t("auth.password_match")}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-start pt-2">
        <Button type="submit" busy={busy} disabled={!canSave}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
